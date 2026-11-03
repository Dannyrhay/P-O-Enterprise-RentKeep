import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./dist/',import.meta.url);
http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname; if(!/^\/[a-zA-Z0-9._/-]*$/.test(path)||path.includes('..'))throw Error();const file=new URL(path==='/'?'index.html':path.slice(1),root);if(!file.href.startsWith(root.href))throw Error();const data=await readFile(fileURLToPath(file));res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','css':'text/css','svg':'image/svg+xml'})[file.pathname.split('.').pop()]||'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('RentKeep production build: http://localhost:4173'));
