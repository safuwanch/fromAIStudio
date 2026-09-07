import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS headers for all API routes
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * Proxy Metadata Route: Resolves real file names and metadata
   */
  app.get('/api/proxy-metadata', async (req: Request, res: Response) => {
    const fileId = req.query.id as string;
    const typeHint = (req.query.type as string) || 'file';
    const authHeader = req.headers.authorization;

    if (!fileId) {
      return res.status(400).json({ error: 'Missing file ID' });
    }

    // 1. If user provided an OAuth token, query Google Drive API v3
    if (authHeader) {
      try {
        const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,iconLink,thumbnailLink`;
        const driveRes = await fetch(driveUrl, {
          headers: { Authorization: authHeader },
        });

        if (driveRes.ok) {
          const data = await driveRes.json();
          return res.json(data);
        }
      } catch (err: any) {
        console.error('Error fetching drive API metadata:', err.message);
      }
    }

    // 2. Unauthenticated public metadata resolution (scrape title from view page)
    try {
      let pageUrl = `https://drive.google.com/file/d/${fileId}/view`;
      if (typeHint === 'doc') pageUrl = `https://docs.google.com/document/d/${fileId}/edit`;
      else if (typeHint === 'sheet') pageUrl = `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
      else if (typeHint === 'slide') pageUrl = `https://docs.google.com/presentation/d/${fileId}/edit`;

      const pageRes = await fetch(pageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        // Extract og:title or <title>
        const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        let extractedTitle = ogTitleMatch?.[1] || titleMatch?.[1] || '';

        // Clean common suffix like " - Google Drive" or " - Google Docs"
        extractedTitle = extractedTitle
          .replace(/\s*-\s*Google\s*(Drive|Docs|Sheets|Slides)\s*$/i, '')
          .trim();

        if (extractedTitle && !extractedTitle.includes('Google Drive - Access Denied') && !extractedTitle.includes('Sign in')) {
          return res.json({
            id: fileId,
            name: extractedTitle,
            mimeType:
              typeHint === 'doc'
                ? 'application/vnd.google-apps.document'
                : typeHint === 'sheet'
                ? 'application/vnd.google-apps.spreadsheet'
                : typeHint === 'slide'
                ? 'application/vnd.google-apps.presentation'
                : 'application/octet-stream',
          });
        }
      }
    } catch (scrapeErr: any) {
      console.warn('Could not scrape public title:', scrapeErr.message);
    }

    // Fallback response
    res.json({
      id: fileId,
      name: `Drive_File_${fileId.substring(0, 8)}`,
      mimeType: 'application/octet-stream',
    });
  });

  /**
   * Proxy Download Route: Streams file binaries directly to client
   * Completely eliminates browser CORS restrictions and enables direct local saving & zip packaging
   */
  app.get('/api/proxy-download', async (req: Request, res: Response) => {
    const fileId = req.query.id as string;
    const typeHint = (req.query.type as string) || 'file';
    const exportFormat = (req.query.format as string) || '';
    const exportMimeType = (req.query.exportMimeType as string) || '';
    const customName = (req.query.name as string) || `file_${fileId}`;
    const authHeader = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : undefined);

    if (!fileId) {
      return res.status(400).json({ error: 'Missing file ID' });
    }

    try {
      // Strategy 1: If access token is provided, use official Google Drive v3 API
      if (authHeader) {
        let apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        if (typeHint === 'doc' || typeHint === 'sheet' || typeHint === 'slide' || exportMimeType) {
          const mimeToUse =
            exportMimeType ||
            (typeHint === 'doc'
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : typeHint === 'sheet'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
          apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(
            mimeToUse
          )}`;
        }

        const gRes = await fetch(apiUrl, {
          headers: { Authorization: authHeader },
        });

        if (gRes.ok) {
          const contentType = gRes.headers.get('content-type') || 'application/octet-stream';
          const contentLength = gRes.headers.get('content-length');

          res.setHeader('Content-Type', contentType);
          if (contentLength) res.setHeader('Content-Length', contentLength);
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(customName)}"`
          );

          const arrayBuffer = await gRes.arrayBuffer();
          return res.send(Buffer.from(arrayBuffer));
        }
      }

      // Strategy 2: Google Docs / Sheets / Slides direct public export
      if (typeHint === 'doc') {
        const fmt = exportFormat === 'pdf' ? 'pdf' : 'docx';
        const docUrl = `https://docs.google.com/document/d/${fileId}/export?format=${fmt}`;
        const docRes = await fetch(docUrl, { redirect: 'follow' });
        if (docRes.ok) {
          const arrayBuffer = await docRes.arrayBuffer();
          res.setHeader('Content-Type', docRes.headers.get('content-type') || 'application/octet-stream');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(customName)}"`
          );
          return res.send(Buffer.from(arrayBuffer));
        }
      } else if (typeHint === 'sheet') {
        const fmt = exportFormat === 'pdf' ? 'pdf' : exportFormat === 'csv' ? 'csv' : 'xlsx';
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=${fmt}`;
        const sheetRes = await fetch(sheetUrl, { redirect: 'follow' });
        if (sheetRes.ok) {
          const arrayBuffer = await sheetRes.arrayBuffer();
          res.setHeader('Content-Type', sheetRes.headers.get('content-type') || 'application/octet-stream');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(customName)}"`
          );
          return res.send(Buffer.from(arrayBuffer));
        }
      } else if (typeHint === 'slide') {
        const fmt = exportFormat === 'pdf' ? 'pdf' : 'pptx';
        const slideUrl = `https://docs.google.com/presentation/d/${fileId}/export?format=${fmt}`;
        const slideRes = await fetch(slideUrl, { redirect: 'follow' });
        if (slideRes.ok) {
          const arrayBuffer = await slideRes.arrayBuffer();
          res.setHeader('Content-Type', slideRes.headers.get('content-type') || 'application/octet-stream');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(customName)}"`
          );
          return res.send(Buffer.from(arrayBuffer));
        }
      }

      // Strategy 3: Standard public Google Drive binary download
      // Primary direct usercontent download URL
      const primaryUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
      let gDriveRes = await fetch(primaryUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });

      // Handle large file virus scan warning page if Google returned HTML
      const respContentType = gDriveRes.headers.get('content-type') || '';
      if (respContentType.includes('text/html')) {
        const htmlText = await gDriveRes.text();

        // Check if there is a confirm token
        const confirmMatch =
          htmlText.match(/href=["'](\/uc\?export=download&amp;confirm=[^"']+)["']/i) ||
          htmlText.match(/name=["']confirm["']\s+value=["']([^"']+)["']/i) ||
          htmlText.match(/confirm=([0-9a-zA-Z_-]+)/);

        if (confirmMatch) {
          const confirmToken = confirmMatch[1].replace(/&amp;/g, '&');
          let confirmUrl = '';
          if (confirmToken.startsWith('/')) {
            confirmUrl = `https://drive.google.com${confirmToken}`;
          } else if (confirmToken.startsWith('confirm=')) {
            confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&${confirmToken}`;
          } else {
            confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`;
          }

          const confirmedRes = await fetch(confirmUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
          });

          if (confirmedRes.ok && !confirmedRes.headers.get('content-type')?.includes('text/html')) {
            const buf = await confirmedRes.arrayBuffer();
            res.setHeader('Content-Type', confirmedRes.headers.get('content-type') || 'application/octet-stream');
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${encodeURIComponent(customName)}"`
            );
            return res.send(Buffer.from(buf));
          }
        }

        // Secondary fallback uc endpoint
        const ucUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const ucRes = await fetch(ucUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
        });

        if (ucRes.ok && !ucRes.headers.get('content-type')?.includes('text/html')) {
          const buf = await ucRes.arrayBuffer();
          res.setHeader('Content-Type', ucRes.headers.get('content-type') || 'application/octet-stream');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(customName)}"`
          );
          return res.send(Buffer.from(buf));
        }

        // If it was HTML and not binary, file might be private or restricted
        return res.status(403).json({
          error:
            'This Google Drive file is private or requires authorization. Please sign in with Google or ensure file is set to "Anyone with the link can view".',
        });
      }

      if (gDriveRes.ok) {
        const arrayBuffer = await gDriveRes.arrayBuffer();
        res.setHeader('Content-Type', gDriveRes.headers.get('content-type') || 'application/octet-stream');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(customName)}"`
        );
        return res.send(Buffer.from(arrayBuffer));
      }

      return res.status(gDriveRes.status).json({
        error: `Google returned HTTP status ${gDriveRes.status}. File may be private or deleted.`,
      });
    } catch (err: any) {
      console.error('Download proxy error:', err);
      return res.status(500).json({ error: `Download failed: ${err.message}` });
    }
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
