//
// Service worker
// (◡ ‿ ◡ ✿)
//
// This worker is responsible for caching the application
// so it can be used offline.


import IPFS from "ipfs"


importScripts("version.js")


const KEY =
  "diffuse-" + self.VERSION


const exclude =
  [ "_headers"
  , "_redirects"
  , "CORS"
  ]



// 📣


self.addEventListener("install", event => {
  const href = self.location.href.replace("service-worker.js", "")
  const promise = removeAllCaches()
    .then(_ => fetch("tree.json"))
    .then(response => response.json())
    .then(tree => {
      const filteredTree = tree.filter(t => !exclude.find(u => u === t))
      const whatToCache = [ href, "brain.elm.js", "ui.elm.js" ].concat(filteredTree)
      return caches.open(KEY).then(c => Promise.all(whatToCache.map(x => c.add(x))))
    })

  event.waitUntil(promise)
})


self.addEventListener("fetch", event => {
  // const isNotLocal =
  //   !event.request.url.match(new RegExp("^https?\:\/\/127.0.0.1")) &&
  //   !event.request.url.match(new RegExp("^https?\:\/\/localhost"))

  const isInternal =
    !!event.request.url.match(new RegExp("^" + self.location.origin))

  const isOffline =
    !self.navigator.onLine

  // Use cache if offline and identified as cached (internal)
  if (isInternal && isOffline) {
    const promise = caches
      .match(event.request)
      .then(r => r || fetch(event.request))

    event.respondWith(promise)

  // Internal IPFS request
  } else if (event.request.url.startsWith(DEFAULT_IPFS_GATEWAY)) {
    const promise = defaultIpfsCheck().then(isOnline => {
      return isOnline
        ? fetch(event.request)
        : ensureTemporaryIpfsNode().then(translateIpfsRequest(event.request))
    })

    event.respondWith(promise)

  // When doing a request with basic authentication in the url, put it in the headers instead
  } else if (event.request.url.includes("service_worker_authentication=")) {
    const [urlWithoutToken, token] = event.request.url.split("service_worker_authentication=")

    newRequestWithAuth(
      event,
      urlWithoutToken,
      "Basic " + token
    )

  // When doing a request with access token in the url, put it in the headers instead
  } else if (event.request.url.includes("&access_token=")) {
    const [urlWithoutToken, token] = event.request.url.split("&access_token=")

    newRequestWithAuth(
      event,
      urlWithoutToken,
      "Bearer " + token
    )

  }
})



// ⚗️


function newRequestWithAuth(event, urlWithoutToken, authToken) {
  const newHeaders = new Headers()

  for (const h of event.request.headers.entries()) {
    switch (h[0]) {
      case "range":
        newHeaders.append(h[0], h[1])
    }
  }

  newHeaders.set("authorization", authToken)

  const newRequest = new Request(event.request, {
    headers: newHeaders,
    url: urlWithoutToken
  })

  event.respondWith(fetch(newRequest))
}


function removeAllCaches() {
  return caches.keys().then(keys => {
    const promises = keys.map(k => caches.delete(k))
    return Promise.all(promises)
  })
}



// ⚡️  ░░  IPFS


const DEFAULT_IPFS_GATEWAY = "http://127.0.0.1:8080"


let ipfsGateCheck
let ipfsNode


function defaultIpfsCheck() {
  return ipfsGateCheck === undefined
    ? fetch(DEFAULT_IPFS_GATEWAY + "/api/v0/version")
        .then(r => { ipfsGateCheck = r.ok; return r.ok })
        .catch(_ => { ipfsGateCheck = false; return false })
    : Promise.resolve(ipfsGateCheck)
}


function ensureTemporaryIpfsNode() {
  if (ipfsNode) {
    return Promise.resolve(ipfsNode)

  } else {
    return IPFS.create().then(n => {
      ipfsNode = n
      return n
    })

  }
}


function translateIpfsRequest(request) { return ipfs => {
  const url = new URL(request.url)

  switch (url.pathname) {
    case "/api/v0/dns":
      // return ipfs.dns(url.searchParams.get("arg"))

      const domain = url.searchParams.get("arg")
      const domainWithPrefix = domain.startsWith("_dnslink.") ? domain : "_dnslink." + domain

      return fetch(
        "https://cloudflare-dns.com/dns-query?type=TXT&name=" + domainWithPrefix,
        { headers: new Headers({ "Accept" : "application/dns-json" }) }
      )

    case "/api/v0/ls":
      console.log("ls", url.searchParams.get("arg"))
      return ipfs.ls(url.searchParams.get("arg"))

    case "/api/v0/name/resolve":
      return ipfs.name.resolve(
        url.searchParams.get("arg"),
        { local: url.searchParams.get("local") === "true" }
      )

    default:
      return ipfs.get(url.pathname)
  }
}}
