document.getElementById('save').onclick=async()=>{
 const result=document.getElementById('result');
 try{
  const capture=JSON.parse(document.getElementById('capture').value);
  const session=await (await fetch('/api/session')).json();
  const response=await fetch('/api/readback/import',{method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':session.token},body:JSON.stringify(capture)});
  const data=await response.json();if(!response.ok)throw Error(data.error);
  result.textContent=JSON.stringify(data);
 }catch(error){result.textContent='保存失败：'+error.message;}
};
