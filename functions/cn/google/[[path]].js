const GOOGLE_DOH_ENDPOINT = 'https://dns.google/dns-query';
const DEFAULT_EDNS_CLIENT_SUBNET = '119.6.6.0/24';

export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    
    // 构建目标 URL
    const targetUrl = new URL(GOOGLE_DOH_ENDPOINT);
    
    // 强制使用默认 EDNS 客户端子网
    forceDefaultEdns(targetUrl);
    
    // 处理 DNS 查询参数
    handleDnsParameters(url, targetUrl);
    
    // 克隆并修改请求
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: cleanHeaders(request.headers),
      body: request.body,
      redirect: 'follow'
    });
    
    // 发送代理请求
    const response = await fetch(proxyRequest);
    
    // 处理并返回响应
    return createProxyResponse(response);

  } catch (err) {
    return new Response(`Google DNS Proxy Error: ${err.message}`, {
      status: 502,
      headers: { 
        'Content-Type': 'text/plain',
        'X-Proxy-Error': 'true'
      }
    });
  }
}

// 强制使用默认 EDNS 客户端子网
function forceDefaultEdns(targetUrl) {
  // 始终设置默认 EDNS 客户端子网
  targetUrl.searchParams.set('edns_client_subnet', DEFAULT_EDNS_CLIENT_SUBNET);
}

// 处理 DNS 查询参数
function handleDnsParameters(sourceUrl, targetUrl) {
  // 保留原始查询参数中的 dns 参数
  if (sourceUrl.searchParams.has('dns')) {
    targetUrl.searchParams.set('dns', sourceUrl.searchParams.get('dns'));
  }
  
  // 支持 Google 的 JSON API 参数格式
  if (sourceUrl.searchParams.has('name') && sourceUrl.searchParams.has('type')) {
    targetUrl.searchParams.set('name', sourceUrl.searchParams.get('name'));
    targetUrl.searchParams.set('type', sourceUrl.searchParams.get('type'));
    
    // 添加其他可选参数
    if (sourceUrl.searchParams.has('cd')) {
      targetUrl.searchParams.set('cd', sourceUrl.searchParams.get('cd'));
    }
    if (sourceUrl.searchParams.has('do')) {
      targetUrl.searchParams.set('do', sourceUrl.searchParams.get('do'));
    }
  }
}

// 清理请求头
function cleanHeaders(headers) {
  const newHeaders = new Headers(headers);
  
  // 移除敏感头
  const toRemove = [
    'cookie', 'cf-connecting-ip', 'x-forwarded-for',
    'x-real-ip', 'cf-ray', 'cf-request-id', 'authorization'
  ];
  
  toRemove.forEach(header => newHeaders.delete(header));
  
  // 对于POST请求，Content-Type必须是application/dns-message
  if (newHeaders.get('Content-Type') === 'application/dns-message') {
    newHeaders.set('Accept', 'application/dns-message');
  } else {
    // 对于JSON请求，使用application/dns-json
    newHeaders.set('Accept', 'application/dns-json');
  }
  
  return newHeaders;
}

// 创建代理响应
function createProxyResponse(response) {
  const proxyResponse = new Response(response.body, response);
  
  // 设置响应头
  proxyResponse.headers.set('Access-Control-Allow-Origin', '*');
  proxyResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  proxyResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  proxyResponse.headers.set('X-Proxy-Service', 'Cloudflare-Pages-Google-DoH');
  proxyResponse.headers.set('X-EDNS-Supported', 'true');
  
  // 根据响应类型设置正确的 Content-Type
  const contentType = proxyResponse.headers.get('Content-Type') || '';
  if (contentType.includes('dns-message')) {
    proxyResponse.headers.set('Content-Type', 'application/dns-message');
  } else if (contentType.includes('json')) {
    proxyResponse.headers.set('Content-Type', 'application/dns-json');
  }
  
  // 删除冲突的头
  proxyResponse.headers.delete('content-security-policy');
  proxyResponse.headers.delete('strict-transport-security');
  
  return proxyResponse;
}
