(function(){
  const body=document.body;
  const toggle=document.querySelector('.menu-toggle');
  const nav=document.getElementById('primary-nav');
  if(toggle&&nav){
    toggle.addEventListener('click',()=>{
      const open=body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded',String(open));
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false')}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false')}});
    document.querySelectorAll('.nav-item>button').forEach(btn=>btn.addEventListener('click',()=>btn.parentElement.classList.toggle('open')));
  }
  const io='IntersectionObserver' in window?new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}})},{threshold:.12}):null;
  document.querySelectorAll('.reveal').forEach(el=>io?io.observe(el):el.classList.add('is-visible'));
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  const form=document.querySelector('[data-contact-form]');
  if(form){
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const data=new FormData(form);
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
      const status=form.querySelector('.form-status');
      if(status) status.textContent='Opening your email app with the enquiry ready to send…';
      window.location.href=url;
    });
  }
})();
