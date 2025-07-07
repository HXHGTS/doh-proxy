export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    // 构建目标 URL (保留原始查询参数)
    const targetUrl = new URL('https://dns.google/dns-query');
    targetUrl.search = url.search;

    // 克隆原始请求并修改关键属性
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      redirect: 'follow'
    });

    // 添加/覆盖必要的请求头
    proxyRequest.headers.set('Host', targetUrl.hostname);
    proxyRequest.headers.delete('cookie'); // 移除敏感头
    proxyRequest.headers.delete('cf-connecting-ip');
    proxyRequest.headers.delete('x-forwarded-for');

    // 发送代理请求
    const response = await fetch(proxyRequest);

    // 克隆响应并修改头
    const proxyResponse = new Response(response.body, response);
    proxyResponse.headers.set('Access-Control-Allow-Origin', '*');
    proxyResponse.headers.set('X-Proxy-Service', 'Cloudflare-Pages');

    // 删除 CSP 头避免冲突
    proxyResponse.headers.delete('content-security-policy');
    
    return proxyResponse;

  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
