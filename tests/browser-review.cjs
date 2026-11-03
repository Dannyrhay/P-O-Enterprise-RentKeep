async (page) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4182');
  await page.getByRole('button',{name:'Explore fictional demo'}).click();
  const results=[];
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    const small=width<=760;
    const nav=page.getByRole('navigation',{name:small?'Mobile navigation':'Main navigation'});
    for(const [label,title] of [['Overview','Overview'],[small?'Locations':'Locations & tenants','Locations & tenants'],['Payments','Invoices & payments'],['Reminders','Renewal reminders'],['Settings','Settings']]){
      await nav.getByRole('button',{name:new RegExp('^'+label)}).click();
      await page.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      if(overflow)throw Error('Horizontal overflow at '+width+' on '+title);
    }
    const siblings=await page.getByLabel(/Sibling [12] · Admin/).count();if(siblings!==2)throw Error('Sibling accounts missing');
    results.push(width+'px: all five screens fit');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Overview'}).click();
  await page.getByRole('button',{name:'Add tenancy',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  const fits=await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.height<=innerHeight});
  if(!fits)throw Error('Phone form does not fit');
  await page.keyboard.press('Escape');
  if(errors.length)throw Error(errors.join('; '));
  return {results,mobileDialogFits:fits,pageErrors:errors.length};
}
