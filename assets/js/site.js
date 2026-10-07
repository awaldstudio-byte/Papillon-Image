(function(){
  const body=document.body;
  const toggle=document.querySelector('.menu-toggle');
  const nav=document.getElementById('primary-nav');
  if(toggle&&nav){
    toggle.addEventListener('click',()=>{
      const open=body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Close menu':'Open menu');
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false')}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&body.classList.contains('nav-open')){body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open menu');toggle.focus()}});
    const desktop=window.matchMedia('(min-width:1181px)');
    desktop.addEventListener('change',()=>{if(desktop.matches){body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open menu')}});
    document.querySelectorAll('.nav-item>button').forEach(btn=>btn.addEventListener('click',()=>btn.parentElement.classList.toggle('open')));
  }
  const io='IntersectionObserver' in window?new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}})},{threshold:.12}):null;
  document.querySelectorAll('.reveal').forEach(el=>io?io.observe(el):el.classList.add('is-visible'));
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  // Settle incoming service anchors after the local fonts finish loading.
  // Do not pull a visitor back after they have already started interacting.
  const initialHash=window.location.hash;
  if(initialHash){
    let interacted=false;
    const markInteraction=()=>{interacted=true};
    for(const event of ['wheel','touchstart','keydown'])window.addEventListener(event,markInteraction,{once:true,passive:true});
    const settleAnchor=()=>Promise.resolve(document.fonts?.ready).then(()=>{
      if(interacted||window.location.hash!==initialHash)return;
      try{document.getElementById(decodeURIComponent(initialHash.slice(1)))?.scrollIntoView({block:'start',behavior:'instant'})}catch{}
    });
    if(document.readyState==='complete')settleAnchor();else window.addEventListener('load',settleAnchor,{once:true});
  }
  const form=document.querySelector('[data-contact-form]');
  if(form){
    const status=form.querySelector('.form-status');
    const submit=form.querySelector('[data-submit]');
    const deliveryNote=document.querySelector('[data-delivery-note]');
    let directSend=false;
    const selected=new URLSearchParams(window.location.search).get('service');
    if(selected&&Array.from(form.elements.service.options).some(option=>option.value===selected))form.elements.service.value=selected;
    const availability=new AbortController();
    const availabilityTimeout=setTimeout(()=>availability.abort(),4000);
    const ready=fetch('/api/contact',{headers:{Accept:'application/json'},cache:'no-store',signal:availability.signal})
      .then(response=>response.ok?response.json():null).then(data=>{
        directSend=data?.configured===true;
        if(directSend){submit.textContent='Let’s start the conversation';deliveryNote.textContent='Your enquiry will be sent directly to Helga.'}
      }).catch(()=>{}).finally(()=>clearTimeout(availabilityTimeout));
    function showError(){
      status.replaceChildren();status.dataset.state='error';
      const heading=document.createElement('strong');heading.textContent='Oops — your message didn’t go through.';
      const message=document.createElement('p');message.textContent='Please try again, or if you’re still having trouble, you’re welcome to contact me directly via WhatsApp or email.';
      const links=document.createElement('p');
      for(const [label,href]of [['WhatsApp Helga','https://wa.me/27827458207'],['Email Helga','mailto:helga@papillon-image.co.za']]){const a=document.createElement('a');a.textContent=label;a.href=href;links.append(a,document.createTextNode(' '))}
      status.append(heading,message,links);status.focus();
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(submit.disabled)return;
      submit.disabled=true;
      await ready;
      const data=new FormData(form);
      if(data.get('website')){submit.disabled=false;showError();return}
      if(directSend){
        submit.disabled=true;status.dataset.state='pending';status.textContent='Sending your message…';
        const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
        try{
          const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(data)),signal:controller.signal});
          const result=await response.json();
          if(!response.ok||result.ok!==true)throw new Error('Delivery failed');
          status.replaceChildren();status.dataset.state='success';
          const heading=document.createElement('strong');heading.textContent='Thank you for getting in touch.';
          const message=document.createElement('p');message.textContent='Your message has been sent successfully. I’ll get back to you as soon as I can.';
          const signature=document.createElement('p');signature.append('With you, in style,',document.createElement('br'),'Helga');
          status.append(heading,message,signature);form.reset();status.focus();
        }catch{showError()}finally{clearTimeout(timeout);submit.disabled=false}
        return;
      }
      const subject='Papillon Image enquiry from '+(data.get('name')||'website visitor');
      const bodyText=[
        'Name: '+(data.get('name')||''),
        'Email: '+(data.get('email')||''),
        'Phone: '+(data.get('phone')||''),
        'Interested in: '+(data.get('service')||''),
        '',
        data.get('message')||''
      ].join('\n');
      const url='mailto:helga@papillon-image.co.za?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(bodyText);
      if(status){status.dataset.state='prepared';status.textContent='Your enquiry is ready in your email app. Please review it and press Send there. It has not been sent by this website.'}
      submit.disabled=false;
      window.location.href=url;
    });
  }
})();
