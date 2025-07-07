const GOOGLE_DOH_ENDPOINT = 'https://dns.google/dns-query';
const DEFAULT_EDNS_CLIENT_SUBNET = '119.6.6.0/24';

export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const clientIP = request.headers.get('cf-connecting-ip') || '';
    
    // 构建目标 URL
    const targetUrl = new URL(GOOGLE_DOH_ENDPOINT);
    
    // 处理 EDNS 参数
    handleEdnsParameters(url, targetUrl, clientIP);
    
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

// 处理 EDNS 相关参数
function handleEdnsParameters(sourceUrl, targetUrl, clientIP) {
  // 如果源URL中有edns_client_subnet参数，则使用它
  if (sourceUrl.searchParams.has('edns_client_subnet')) {
    targetUrl.searchParams.set('edns_client_subnet', sourceUrl.searchParams.get('edns_client_subnet'));
  } else if (clientIP && isValidIP(clientIP)) {
    // 否则，如果客户端IP有效，则自动生成子网
    const clientSubnet = getClientSubnet(clientIP);
    targetUrl.searchParams.set('edns_client_subnet', clientSubnet);
  }
  // 否则不传递edns_client_subnet参数，让Google使用默认值
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

// 验证IP地址格式
function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// 获取客户端子网
function getClientSubnet(ip) {
  if (ip.includes(':')) {
    // IPv6 地址 - 使用 /56 子网
    const parts = ip.split(':');
    return `${parts.slice(0, 4).join(':')}::/56`;
  } else {
    // IPv4 地址 - 使用 /24 子网
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
}

// 生成 base64 编码的 DNS 查询
function generateBase64DnsQuery(name, type = 'A') {
  // 这是一个简化的示例，实际实现需要完整的DNS报文生成
  const dnsHeader = 'AAAB'; // 示例头部
  const encodedName = name.split('.').map(part => {
    return part.length.toString(16).padStart(2, '0') + 
           Buffer.from(part).toString('hex');
  }).join('');
  
  const queryType = {
    'A': '0001',
    'AAAA': '001c',
    'CNAME': '0005',
    'MX': '000f',
    'TXT': '0010'
  }[type.toUpperCase()] || '0001';
  
  return Buffer.from(dnsHeader + encodedName + '00' + queryType + '0001', 'hex').toString('base64');
}
