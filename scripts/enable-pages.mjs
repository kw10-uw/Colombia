// Uses the existing Git Credential Manager session in memory; never prints credentials.
import { execFileSync } from 'node:child_process';
const repo = 'kw10-uw/Colombia';
let secret;
try {
 const result=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
 secret=result.split(/\r?\n/).find(line=>line.startsWith('password='))?.slice(9);
}catch { console.error('No non-interactive GitHub credential is available. Enable Pages manually in repository Settings → Pages → GitHub Actions.');process.exit(1); }
if(!secret){console.error('No GitHub credential available.');process.exit(1);}
const headers={Authorization:`Bearer ${secret}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
let response=await fetch(`https://api.github.com/repos/${repo}/pages`,{headers});
if(response.status===404) response=await fetch(`https://api.github.com/repos/${repo}/pages`,{headers,method:'POST',body:JSON.stringify({build_type:'workflow'})});
else if(response.ok){const state=await response.json();if(state.build_type!=='workflow')response=await fetch(`https://api.github.com/repos/${repo}/pages`,{headers,method:'PUT',body:JSON.stringify({build_type:'workflow'})});else{console.log(JSON.stringify({status:'enabled',url:state.html_url,build_type:state.build_type}));process.exit(0);}}
const data=await response.json().catch(()=>({}));
console.log(JSON.stringify({http_status:response.status,status:response.ok?'enabled':'not_enabled',url:data.html_url,message:data.message,build_type:data.build_type}));
if(!response.ok)process.exitCode=1;
