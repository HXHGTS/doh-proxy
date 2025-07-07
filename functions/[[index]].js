export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    
    // 检查是否为根路径请求
    if (url.pathname === '/') {
      return create404Response();
    }
    
    // 如果不是根路径，返回默认的Pages响应
    return context.next();

  } catch (err) {
    return new Response(`Error: ${err.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// 创建404响应
function create404Response() {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 Not Found</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d);
          height: 100vh;
          margin: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          text-align: center;
        }
        .container {
          background: rgba(0, 0, 0, 0.7);
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          max-width: 600px;
          width: 90%;
        }
        h1 {
          font-size: 5rem;
          margin: 0;
          color: #ff5252;
          text-shadow: 0 0 10px rgba(255, 82, 82, 0.5);
        }
        h2 {
          font-size: 2rem;
          margin-top: 0;
        }
        p {
          font-size: 1.2rem;
          line-height: 1.6;
        }
        .links {
          margin-top: 30px;
          display: flex;
          justify-content: center;
          gap: 20px;
        }
        a {
          color: #4fc3f7;
          text-decoration: none;
          font-weight: bold;
          padding: 10px 20px;
          border: 2px solid #4fc3f7;
          border-radius: 5px;
          transition: all 0.3s;
        }
        a:hover {
          background: #4fc3f7;
          color: #000;
        }
        .animation {
          margin: 30px 0;
          font-size: 5rem;
          animation: bounce 2s infinite;
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
          40% {transform: translateY(-30px);}
          60% {transform: translateY(-15px);}
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="animation">🔍</div>
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>Oops! The page you're looking for doesn't exist.</p>
        <p>You might have mistyped the address or the page may have moved.</p>
        
        <p style="margin-top: 30px; font-size: 0.9rem;">
          <small>Powered by Cloudflare Pages</small>
        </p>
      </div>
    </body>
    </html>
  `;
  
  return new Response(htmlContent, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-404-Page': 'custom'
    }
  });
}
