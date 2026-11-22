(() => {
  const { head, button, badge, row, field, input, select } = window.U;
  const managed = role => role === 'admin' || role === 'president';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const submit = label => `<button class="button primary" type="submit">${label}</button>`;
  const form = (message, content) => `<form class="stack" data-demo-form="${esc(message)}">${content}</form>`;
  const detail = (title, content, open = false) => `<details class="panel"${open ? ' open' : ''}><summary>${title}</summary><div class="stack">${content}</div></details>`;
  const number = (name, value, max = '') => `<input type="number" name="${name}" value="${value}" min="0" step="any"${max ? ` max="${max}"` : ''} required>`;
  const text = (name, value = '') => `<input name="${name}" value="${esc(value)}" required>`;
  const denied = (_role, title) => head('Team', title, 'Management permission required.', button('Back to Team', 'team'));
  const table = (caption, columns, rows) => `<div class="table-wrap" role="region" aria-label="${caption}" tabindex="0"><table class="data-table"><caption>${caption}</caption><thead><tr>${columns.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  const filter = (scope, statuses, label = 'Status') => `<form class="filter-bar" data-team-filter="${scope}" role="search">${field('Search', `<input type="search" name="query" placeholder="Search names or records">`)}${field(label, `<select name="status">${statuses.map(([value, title]) => `<option value="${value}">${title}</option>`).join('')}</select>`)}<button class="button" type="reset">Clear</button></form>`;
  const noMatches = scope => `<div class="empty" data-team-empty="${scope}" hidden><h2>No matches</h2><p>Try another search or filter.</p></div>`;
  const cmd = (label, action, attrs = '', primary = false) => `<button type="button" class="button${primary ? ' primary' : ''}" data-team-action="${action}" ${attrs}>${label}</button>`;
  const grantNames = ['manage_accounts','manage_invitations','manage_tasks','manage_groups','manage_seasons','manage_outreach_events','manage_outreach_attendance','manage_build_hours','manage_opis','export_records','manage_purchases','manage_scouting'];
  const people = [
    {id:'maya', name:'Maya Patel', grade:'11', group:'Mechanical', bio:'Designing the intake and building reliable mechanisms.', email:'maya.patel@example.test', role:'MEMBER', display:'MEMBER', status:'active', verified:true, grants:[]},
    {id:'alex', name:'Alex Chen', grade:'12', group:'Software', bio:'Controls, autonomous routines, and teaching new programmers.', email:'alex.chen@example.test', role:'MEMBER', display:'MEMBER', status:'active', verified:true, grants:[]},
    {id:'sam', name:'Sam Rivera', grade:'10', group:'Outreach', bio:'Community demonstrations and STEM workshops.', email:'sam.rivera@example.test', role:'MEMBER', display:'MEMBER', status:'active', verified:true, grants:[]},
    {id:'jordan', name:'Jordan Lee', grade:'10', group:'', email:'jordan.lee@example.test', role:'PENDING', display:'PENDING', status:'pending', verified:true, grants:[]},
    {id:'riley', name:'Riley Morgan', grade:'10', group:'', email:'riley.morgan@example.test', role:'PENDING', display:'PENDING', status:'pending', verified:false, grants:[]},
    {id:'casey', name:'Casey Kim', grade:'12', group:'', email:'casey.kim@example.test', role:'MEMBER', display:'MEMBER', status:'inactive', verified:true, grants:[]},
    {id:'devon', name:'Devon Brooks', grade:'12', group:'Software', email:'devon.brooks@example.test', role:'OFFICER', display:'OFFICER', status:'active', verified:true, grants:['manage_tasks']}
  ];
  const state = {role:'member', tab:'groups', group:'mechanical', season:'current', groups:[{id:'mechanical',name:'Mechanical',members:['maya']},{id:'software',name:'Software',members:['alex','devon']},{id:'outreach',name:'Outreach',members:['sam']}], invites:[{id:'1',days:7,status:'Active',expires:'Nov 8, 2026'}], seasons:[{id:'current',name:'2026–27',build:40,outreach:20,cap:6,current:true},{id:'previous',name:'2025–26',build:40,outreach:20,cap:6,current:false}], categories:[{id:'robot',name:'Robot development',used:true},{id:'outreach',name:'Outreach',used:true}], notice:''};
  const accountRoutes = {member:'maya','member-alex':'alex','member-sam':'sam','member-admission':'jordan','member-unverified':'riley','member-inactive':'casey','member-admin':'devon'};
  const profileRoute = p => `profile-${p.id}`;
  const accountRoute = p => Object.keys(accountRoutes).find(key => accountRoutes[key] === p.id);
  const roleStatus = role => managed(role) ? `<span class="small muted">${role === 'president' ? 'President · all permissions' : 'Officer · 12 assigned grants'}</span>` : '';
  const notice = () => state.notice ? `<p class="notice success" role="status">${esc(state.notice)}</p>` : '';
  const teamShortcuts = role => managed(role) ? `<section class="panel"><h2>Manage team</h2>${row('Reviews','Pending decisions','reviews')}${row('Members','Accounts & permissions','members')}${row('Setup','Groups, invitations & season','setup')}${row('Reports & history','Hours, records & purchases','reports')}${row('Build operations','Attendance & checkout health','build')}${role === 'president' ? row('Organization settings','Name, radius & timezone','settings') : ''}</section>` : '';

  window.screens.team = ({role}) => {
    state.role = role;
    return head('Team','Our team','',managed(role) ? button('Manage members','members') : '') + filter('directory',[['all','All groups'],...state.groups.map(g => [g.id,g.name])],'Group') + `<div class="layout"><section><div class="team-profile-grid">${people.filter(p => p.status === 'active' && p.role !== 'PENDING').map(p => {
      const groups = state.groups.filter(g => g.members.includes(p.id));
      return `<a class="panel team-profile-card" href="#${profileRoute(p)}" data-team-record="directory" data-search="${esc(p.name+' '+groups.map(g=>g.name).join(' '))}" data-status="${groups.map(g=>g.id).join(' ')}"><span class="team-avatar" aria-hidden="true">${p.name.split(' ').map(n=>n[0]).join('')}</span><h2>${p.name}</h2><p class="small muted">${groups.map(g=>esc(g.name)).join(' · ') || 'Team member'} · Grade ${p.grade}</p>${badge(p.display)}</a>`;
    }).join('')}</div>${noMatches('directory')}</section><aside class="stack"><section class="panel"><h2>My groups</h2>${state.groups.filter(g=>g.members.includes('maya')).map(g=>row(g.name,`${g.members.length} member${g.members.length===1?'':'s'}`,'work')).join('') || '<p class="muted">No groups yet</p>'}</section>${teamShortcuts(role)}</aside></div>`;
  };
  for (const {id} of people) window.screens[`profile-${id}`] = ({role}) => {
    state.role = role;
    const p = people.find(p=>p.id===id);
    if (p.status !== 'active') return head('Team','Profile unavailable','',button('Back to Team','team'));
    return head('Team / Profile',p.name,'',button('Back to Team','team')) + `<section class="panel stack"><div><span class="team-avatar" aria-hidden="true">${p.name.split(' ').map(n=>n[0]).join('')}</span> ${badge(p.display)}</div>${p.bio?`<p>${p.bio}</p>`:''}<dl class="team-contact"><dt>Grade</dt><dd>${p.grade}</dd><dt>Groups</dt><dd>${state.groups.filter(g=>g.members.includes(p.id)).map(g=>esc(g.name)).join(' · ') || 'None'}</dd></dl>${managed(role) && accountRoute(p) ? button('Manage account',accountRoute(p)) : ''}</section>`;
  };
  window.screens.members = ({role}) => {
    state.role = role;
    if (!managed(role)) return denied(role,'Members');
    return head('Team / Members','Members','',button('Team setup','setup')) + roleStatus(role) + notice() + filter('members',[['all','All accounts'],['active','Verified · Active'],['pending','Verified · Pending'],['unverified','Unverified · Pending'],['inactive','Inactive']]) + `<section class="panel">${people.filter(p=>accountRoute(p)&&p.status!=='rejected').map(p=>`<div data-team-record="members" data-search="${esc(p.name+' '+p.role)}" data-status="${p.verified?p.status:'unverified'}">${row(p.name,`${p.role} · ${p.verified?'Verified':'Unverified'} · ${p.grants.length} assigned grants`,accountRoute(p),badge(p.status,p.status==='active'?'success':p.status==='pending'?'warning':'neutral'))}</div>`).join('')}${noMatches('members')}</section>`;
  };
  function accountMenu(p, role) {
    const attrs = `data-person="${p.id}"`;
    const actions = [];
    if (p.status === 'pending') {
      if (p.verified) actions.push(cmd('Admit as Member','admit',attrs));
      actions.push(cmd('Reject account','reject',attrs));
    } else if (p.status === 'inactive') actions.push(cmd('Activate account','activate',attrs));
    else if (p.status === 'active' && p.role !== 'PRESIDENT') {
      if (p.role === 'MEMBER') actions.push(cmd('Deactivate account','deactivate',attrs));
      actions.push(cmd('Edit assigned grants','grants',attrs));
      if (role === 'president') {
        if (p.role === 'MEMBER') actions.push(cmd('Promote to administrator', 'promote',attrs));
        if (p.role !== 'MEMBER') actions.push(cmd('Demote to Member','demote',attrs));
        actions.push(cmd('Transfer Presidency','transfer',attrs));
      }
    }
    return actions.length ? `<div class="team-menu"><button type="button" class="button" data-team-menu aria-expanded="false" aria-controls="account-actions">Account actions <span aria-hidden="true">⋯</span></button><div id="account-actions" class="team-menu-panel panel" hidden>${actions.join('')}</div></div>` : '';
  }
  for (const [route,id] of Object.entries(accountRoutes)) window.screens[route] = ({role}) => {
    state.role = role;
    if (!managed(role)) return denied(role,'Member account');
    const p = people.find(p=>p.id===id);
    return head('Members / Account',p.name,'',button('All members','members')+accountMenu(p,role)) + notice() + `<div class="layout"><section class="stack"><section class="panel stack"><div class="actions">${badge(p.status,p.status==='active'?'success':'warning')}${badge(p.verified?'Email verified':'Email unverified')}${badge(p.role)}</div><dl class="team-contact"><dt>Displayed role</dt><dd>${p.display}</dd><dt>Contact</dt><dd>${cmd('Reveal contact details','contact',`data-person="${p.id}"`)}</dd></dl>${p.status==='pending'&&!p.verified?'<p class="notice warning">Admission requires verified email.</p>':''}${p.status==='inactive'?'<p class="small muted">Sign-in disabled · records retained</p>':''}${p.status==='active'?button('Public profile',profileRoute(p)):''}</section><section class="panel"><h2>Independent grants</h2><p class="small muted">Assigned separately from role · ${p.grants.length} of 12</p><div class="actions">${p.grants.length?p.grants.map(g=>badge(g.replaceAll('_',' '))).join(''):'<span class="muted">None assigned</span>'}</div></section></section><aside class="panel"><h2>Season hours</h2><p>2026–27</p><p>Build <strong>${p.id==='maya'?'18':'0'} / 40 h</strong></p><p>Outreach <strong>${p.id==='maya'?'7':'0'} / 20 h</strong></p>${button('View records','reports')}</aside></div>`;
  };

  const setupTabs = () => `<nav class="tabs team-section-tabs" aria-label="Team setup">${[['groups','Groups'],['invitations','Invitations'],['season','Season'],['categories','Task categories']].map(([id,label])=>`<button type="button" class="button${state.tab===id?' primary':''}" data-team-action="setup-tab" data-value="${id}"${state.tab===id?' aria-current="page"':''}>${label}</button>`).join('')}</nav>`;
  function groupPanel() {
    const group = state.groups.find(g=>g.id===state.group) || state.groups[0];
    return `<div class="team-setup-layout"><section class="panel stack"><div class="section-head"><h2>Groups</h2>${cmd('New group','group-new')}</div>${state.groups.map(g=>`<button type="button" class="button${g===group?' primary':''}" data-team-action="select-group" data-value="${g.id}">${esc(g.name)} · ${g.members.length}</button>`).join('') || '<p>No groups</p>'}</section>${group?`<section class="panel stack"><div class="section-head"><h2>${esc(group.name)}</h2>${cmd('Delete group','group-delete',`data-value="${group.id}"`)}</div><form class="stack" data-team-form="membership" data-id="${group.id}"><fieldset class="team-choice-list"><legend>Membership</legend>${people.filter(p=>p.status==='active'&&p.role!=='PENDING').map(p=>`<label class="checkline"><input type="checkbox" name="members" value="${p.id}"${group.members.includes(p.id)?' checked':''}> ${p.name}</label>`).join('')}</fieldset>${submit('Save membership')}</form><p class="small muted">Membership does not assign permissions.</p></section>`:'<section class="empty"><h2>No group selected</h2></section>'}</div>`;
  }
  function invitationsPanel() {
    return `<section class="panel stack"><div class="section-head"><h2>Invitations</h2>${cmd('Create invitation','invite-new','',true)}</div><p class="small muted">Reusable links · verified email and admission still required</p>${state.invites.map(i=>`<div class="row"><div class="row-main"><div class="row-title">Invitation ${i.id}</div><div class="row-meta">Expires ${esc(i.expires)} · ${i.days} day${i.days===1?'':'s'}</div></div><div class="actions">${badge(i.status,i.status==='Active'?'success':'neutral')}${i.status==='Active'?cmd('Copy link','invite-copy',`data-value="${i.id}"`)+cmd('Revoke','invite-revoke',`data-value="${i.id}"`):''}</div></div>`).join('') || '<p>No invitations</p>'}</section>`;
  }
  function seasonPanel() {
    const season = state.seasons.find(s=>s.id===state.season) || state.seasons[0];
    return `<div class="team-setup-layout"><section class="panel stack"><div class="section-head"><h2>Seasons</h2>${cmd('New season','season-new')}</div>${state.seasons.map(s=>`<button type="button" class="button${s===season?' primary':''}" data-team-action="select-season" data-value="${s.id}">${esc(s.name)}${s.current?' · Current':''}</button>`).join('')}</section><section class="panel stack"><div class="section-head"><h2>${esc(season.name)}</h2>${season.current?badge('Current','success'):cmd('Make current','season-current',`data-value="${season.id}"`)}</div><form class="stack" data-team-form="season" data-id="${season.id}">${field('Season name',text('name',season.name))}<fieldset><legend>Uniform member targets · manage_seasons</legend><div class="form-grid">${field('Build hours',number('build',season.build))}${field('Outreach hours',number('outreach',season.outreach))}</div></fieldset>${field('Individual outreach cap (hours)',number('cap',season.cap), 'manage_outreach_attendance · raw approvals retained; event attendance uncapped')}<p class="small muted">Cap changes recalculate counted individual credit for this season, including history.</p>${submit('Save season')}</form></section></div>`;
  }
  function categoriesPanel() {
    return `<section class="panel stack"><div class="section-head"><h2>Task categories</h2>${cmd('New category','category-new')}</div>${state.categories.map(c=>`<div class="row"><strong class="row-main">${esc(c.name)}</strong>${c.used?badge('In use'):cmd('Delete','category-delete',`data-value="${c.id}" aria-label="Delete ${esc(c.name)}"`)}</div>`).join('') || '<p>No categories</p>'}<p class="small muted">Remove a category from its tasks before deleting.</p><div>${button('Review routing on a task','task')}</div></section>`;
  }
  window.screens.setup = ({role}) => {
    state.role = role;
    if (!managed(role)) return denied(role,'Team setup');
    return head('Team / Setup','Team setup','',button('Members','members')) + setupTabs() + notice() + ({groups:groupPanel,invitations:invitationsPanel,season:seasonPanel,categories:categoriesPanel}[state.tab])();
  };

  window.screens.reviews = ({role}) => {
    if (!managed(role)) return denied(role,'Reviews');
    const items = [ ['task','Task review','Test autonomous start alignment','Alex Chen · Software · submitted Nov 1','task-review','manage_tasks / selected reviewer'],['opi','OPI review','Optix Passion Initiative · Library robotics day','Alex Chen · submitted Oct 31','opi-review','manage_opis'],['individual','Individual outreach','Library robotics workshop','Maya Patel · claimed 3 h · submitted Oct 30','individual-review','manage_outreach_attendance'],['purchase','Purchase review','Intake bearings · $38.40','Alex Chen · submitted Nov 1','purchase','manage_purchases'],['admission','Admission','Jordan Lee · season-start admission','Verified prospective account · submitted Nov 1','member-admission','manage_accounts'] ];
    return head('Team / Reviews','Reviews','Pending decisions',button('Reports & history','reports')) + filter('reviews',[['all','All review types'],['task','Task'],['opi','OPI'],['individual','Individual outreach'],['purchase','Purchase'],['admission','Admission']], 'Type') + '<section class="panel">'+items.map(([key,type,title,meta,route,grant])=>`<div data-team-record="reviews" data-search="${type} ${title} ${meta}" data-status="${key}">${row(title,`${type} · ${meta}`,route,badge('Pending','warning'))}<p class="small muted">Eligibility: ${grant}</p></div>`).join('')+noMatches('reviews')+'</section>';
  };

  window.screens['individual-review'] = ({role}) => {
    if (!managed(role)) return denied(role,'Individual outreach review');
    return head('Reviews / Individual outreach','Library robotics workshop','Maya Patel · October 30, 2026 · 2026–27',button('Back to reviews','reviews')) + `<div class="split"><section class="stack"><section class="panel"><div class="section-head"><h2>Submission</h2>${badge('Pending','warning')}</div><dl><dt>Full name</dt><dd>Maya Patel</dd><dt>What I did</dt><dd>Led a three-hour beginner robotics workshop at the library, including setup and cleanup.</dd><dt>Impact</dt><dd>Students built a simple robot and practiced iterative testing. Two volunteers can now run the activity independently.</dd><dt>People impacted</dt><dd>18</dd><dt>Claimed hours</dt><dd>3.00 h</dd><dt>Approved raw hours</dt><dd>Not decided</dd></dl></section><section class="panel"><h2>Season credit</h2><p>6 h cap · 5 h raw approved · 5 h counted</p><p class="small muted">Approving 3 h results in 8 h raw and 6 h counted. Event attendance is uncapped.</p></section></section><aside class="stack"><section class="panel"><h2>Approve</h2>${form('Approval reviewed; no live record changed.',field('Approved hours',number('approved-individual-hours','3'))+'<label class="checkline"><input type="checkbox" name="confirm-individual-approve" required> Confirm approved hours</label>'+submit('Approve hours'))}</section><section class="panel"><h2>Reject</h2>${form('Rejection reviewed; no live record changed.','<p>No credit will be added.</p><label class="checkline"><input type="checkbox" name="confirm-individual-reject" required> Confirm rejection</label>'+submit('Reject request'))}</section></aside></div>`;
  };

  const exportSample = (name,csv) => `<a class="button" download="prototype-${name}.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}">Download prototype ${name} CSV</a>`;
  window.screens.reports = ({role}) => {
    if (!managed(role)) return denied(role,'Reports & retained records');
    return head('Team / Reports','Reports & history','2026–27',button('Reviews','reviews')) + `
      ${detail('Hours & attendance exports · export_records',form('Prototype only: export filters reviewed. Download a clearly labeled static sample below; filters do not query live data.',`<div class="form-grid">${field('Season',select('export-season',['2026–27','2025–26','All seasons']))}${field('Member ID (optional)',input('export-member-id',''))}${field('Outreach event ID (optional)',input('export-event-id',''))}${field('Build session ID (optional)',input('export-session-id',''))}${field('From date',input('export-from','2026-10-01','date'))}${field('Through date',input('export-to','2026-11-02','date'))}</div><p>Dates use Los Angeles day boundaries. Leave a field blank to include all matching records. Outreach event filters apply to outreach exports; build-session filters apply to build exports.</p>${submit('Review export filters')}`)+`<h2>Download example records</h2>${exportSample('outreach-attendance','Season,Event,Member name,Arrival,Departure,Credited minutes,Attendance status,Event status\n2026-27,Library robotics day,Maya Patel,2026-10-30T15:00:00-07:00,2026-10-30T17:00:00-07:00,120,COMPLETE,ACTIVE\n')}${exportSample('build-attendance','Season,Build location,Build session,Member name,Check-in,Check-out,Credited minutes,Checkout method,Session status\n2026-27,Workshop,Saturday robot build,Maya Patel,2026-10-31T10:00:00-07:00,2026-10-31T14:00:00-07:00,240,MANUAL,ACTIVE\n')}${exportSample('individual-outreach','Season,Member name,Request,Event date,Claimed minutes,Approved minutes,Status\n2026-27,Maya Patel,Library robotics workshop,2026-10-30,180,,PENDING\n')}<h3>Season totals · sample summary</h3>${table('2026–27 official hours and uniform targets',['Member','Build','Outreach','Targets'],'<tr><th scope="row">Maya Patel</th><td>32.5 h</td><td>11 h</td><td>40 h build / 20 h outreach</td></tr><tr><th scope="row">Alex Chen · Software</th><td>18 h</td><td>7 h</td><td>40 h build / 20 h outreach</td></tr>')}<p>Alex: raw approved individual 9 h, counted individual 6 h under the 6 h cap, plus 1 h uncapped event attendance = 7 h official outreach. Maya: raw/countable individual 5 h + 6 h event attendance = 11 h before the pending request.</p>`,true)}
      ${detail('OPI report · export_records',`<h3>Optix Passion Initiative analytics</h3><p>2 sample records · 100% approved among decided records (approved + converted, divided by approved + converted + rejected).</p>${table('OPI stage counts',['Stage','Count'],[['Submitted','1'],['Changes requested','0'],['Resubmitted','0'],['Approved','1'],['Rejected','0'],['Converted','0']].map(([stage,count])=>`<tr><th scope="row">${stage}</th><td>${count}</td></tr>`).join(''))}${exportSample('opi-stage-counts','status,count\nSUBMITTED,1\nCHANGES_REQUESTED,0\nRESUBMITTED,0\nAPPROVED,1\nREJECTED,0\nCONVERTED,0\n')}${filter('opi-report',[['all','All states'],['submitted','Submitted'],['changes','Changes requested'],['resubmitted','Resubmitted'],['approved','Approved'],['rejected','Rejected'],['converted','Converted']])}${table('Optix Passion Initiative records',['Title / member','State','Next step'],`<tr data-team-record="opi-report" data-search="Library robotics day Alex Chen" data-status="submitted"><th scope="row">Library robotics day · Alex Chen</th><td>${badge('Submitted','warning')}</td><td>${button('Open retained submission','opi-review')}</td></tr><tr data-team-record="opi-report" data-search="Intake testing Maya Patel" data-status="approved"><th scope="row">Intake testing · Maya Patel</th><td>${badge('Approved','success')}</td><td>${button('Open OPI record','opi')}</td></tr>`)}${noMatches('opi-report')}`)}
      ${detail('Purchase report · export_records',`<h3>Purchase & reimbursement totals</h3><p>Pending: $38.40 · Approved: $42.00 · Rejected: $0.00</p><p>Approved amount by member: Maya Patel $42.00. “Approved” is a decision state, not a purchased or received state.</p>${exportSample('purchases','member,kind,amount,status,description\nAlex Chen,purchase,38.40,PENDING,Intake bearings\nMaya Patel,reimbursement,42.00,APPROVED,Motor connectors\n')}${filter('purchase-report',[['all','All states'],['pending','Pending'],['approved','Approved'],['rejected','Rejected']])}${table('Purchase records',['Item / requester','Kind / amount','State','Record'],`<tr data-team-record="purchase-report" data-search="Intake bearings Alex Chen purchase" data-status="pending"><th scope="row">Intake bearings · Alex Chen</th><td>Purchase order · $38.40</td><td>${badge('Pending','warning')}</td><td>${button('Open purchase','purchase')}</td></tr><tr data-team-record="purchase-report" data-search="Motor connectors Maya Patel reimbursement" data-status="approved"><th scope="row">Motor connectors · Maya Patel</th><td>Reimbursement · $42.00</td><td>${badge('Approved','success')}</td><td>${button('Open purchase','purchase')}</td></tr>`)}${noMatches('purchase-report')}`)}
      ${role === 'president' ? `<section class="panel"><h2>Retained records · President</h2><p>Historical and inactive records remain findable. Decisions still belong in the original domain screens.</p>${filter('retained',[['all','All record types'],['member','Members'],['opi','OPIs'],['purchase','Purchases'],['event','Outreach events'],['task','Tasks'],['build','Build sessions']],'Record type')}${[['member','Avery Davis','Inactive member · retained attendance and submissions','member-inactive'],['opi','Library robotics day','Submitted OPI · Alex Chen','opi-review'],['purchase','Intake bearings','Pending purchase · Alex Chen · $38.40','purchase'],['event','Library robotics day','Past outreach event · Main Library','event'],['task','Test autonomous start alignment','Task · Software · submitted','task-review'],['build','Saturday robot build','Build session · retained attendance','build']].map(([type,title,meta,route])=>`<div data-team-record="retained" data-search="${title} ${meta}" data-status="${type}">${row(title,meta,route)}</div>`).join('')}${noMatches('retained')}</section>` : '<p class="notice">Exports require export_records. President-only retained-record browsing does not broaden other accounts’ record access.</p>'}`;
  };

  window.screens.settings = ({role}) => {
    if (role !== 'president') return denied(role,'Organization settings');
    return head('Team / Settings','Organization settings','President',button('Team setup','setup')) + `<div class="split"><section class="panel"><h2>Organization</h2>${form('Organization settings reviewed; no live settings changed.',field('Organization name',text('organization-name','Optix Robotics'))+field('Team input timezone','<input name="organization-timezone" value="America/Los_Angeles" readonly>','Fixed input timezone · saved instants display in viewer local time')+field('Default build check-in radius (meters)','<input name="build-radius" type="number" min="1" step="any" value="100" required>')+submit('Save organization settings'))}</section><aside class="stack"><section class="panel"><h2>Presidency</h2>${row('Choose a successor','Active, verified student account','members')}</section><section class="panel"><h2>Operations</h2>${row('Automatic checkout health','Scheduler & affected check-ins','build')}${row('Seasons & targets','Current season & outreach cap','setup')}${row('Records & reports','Retained history','reports')}</section></aside></div>`;
  };

  let dialogTrigger = null;
  function closeDialog() {
    const dialog = document.getElementById('team-dialog');
    if (!dialog) return;
    dialog.close();
    dialog.remove();
    if (dialogTrigger?.isConnected) dialogTrigger.focus();
  }
  function openDialog(title, content, action = '', id = '') {
    closeDialog();
    dialogTrigger = document.activeElement;
    if (dialogTrigger?.closest('#account-actions')) dialogTrigger = document.querySelector('[data-team-menu]');
    const dialog = document.createElement('dialog');
    dialog.id = 'team-dialog';
    dialog.className = 'team-dialog panel';
    dialog.setAttribute('aria-labelledby','team-dialog-title');
    dialog.innerHTML = `<div class="section-head"><h2 id="team-dialog-title">${esc(title)}</h2><button type="button" class="icon-button" data-team-action="close-dialog" aria-label="Close dialog">×</button></div>${action ? `<form class="stack" data-team-form="${action}" data-id="${id}">${content}</form>` : content}`;
    dialog.addEventListener('cancel', event => {event.preventDefault();closeDialog();});
    document.body.append(dialog);
    dialog.showModal();
  }
  function refresh(message = '') {
    closeDialog();
    state.notice = message;
    const route = location.hash.slice(1).split('?')[0] || 'team';
    const screen = window.screens[route];
    if (screen) document.getElementById('main').innerHTML = screen({role:state.role});
    if (message) document.querySelector('#main [role="status"]')?.scrollIntoView({block:'nearest'});
  }
  function safety(title, consequence, action, id, label = title, controls = '') {
    openDialog(title,`${consequence ? `<p>${consequence}</p>` : ''}${controls}<label class="checkline"><input type="checkbox" name="confirmed" required> Confirm ${esc(title.toLowerCase())}</label><div class="actions">${cmd('Cancel','close-dialog')}${submit(label)}</div>`,action,id);
  }
  function accountAction(action, id) {
    if (!managed(state.role)) return;
    const p = people.find(p=>p.id===id);
    if (!p) return;
    if (action === 'contact') {
      openDialog(`${p.name} · Contact`, `<dl class="team-contact"><dt>Email</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd></dl>${cmd('Close','close-dialog')}`);
      return;
    }
    if (action === 'grants' && p.status==='active' && p.role!=='PRESIDENT') {
      openDialog(`${p.name} · Assigned grants`, `<p class="small muted">Role: ${p.role} · grants are independent</p><fieldset class="team-choice-list"><legend>Operational permissions</legend>${grantNames.map(g=>`<label class="checkline"><input type="checkbox" name="grants" value="${g}"${p.grants.includes(g)?' checked':''}> ${g.replaceAll('_',' ')}</label>`).join('')}</fieldset><div class="actions">${cmd('Cancel','close-dialog')}${submit('Save grants')}</div>`,'grants',p.id);
      return;
    }
    const ordinary = p.role === 'MEMBER';
    const pending = p.status === 'pending';
    if (action==='admit' && pending && p.verified) safety(`Admit ${p.name}`,'Joins as Member with no assigned grants.','admit',id,'Admit as Member');
    if (action==='reject' && pending) safety(`Reject ${p.name}`,'Removes the prospective account only if it has no retained operational history.','reject',id,'Reject account');
    if (action==='deactivate' && ordinary && p.status==='active') safety(`Deactivate ${p.name}`,'Blocks sign-in. Attendance, submissions and independent grants are retained.','deactivate',id,'Deactivate account');
    if (action==='activate' && ordinary && p.status==='inactive') safety(`Activate ${p.name}`,'Restores sign-in with existing independent grants.','activate',id,'Activate account');
    if (state.role!=='president' || p.status!=='active' || !p.verified || p.role==='PRESIDENT') return;
    if (action==='promote' && ordinary) safety(`Promote ${p.name}`,'Administrator role does not automatically assign operational grants.','promote',id,'Promote',field('Administrator role',select('admin-role',['LEADERSHIP','OFFICER'])));
    if (action==='demote' && !ordinary) safety(`Demote ${p.name}`,'Becomes Member. Independently assigned grants remain unchanged.','demote',id,'Demote to Member');
    if (action==='transfer') safety(`Transfer Presidency to ${p.name}`,'You become Officer and lose implicit all-permission access. Both accounts retain their independent grants.','transfer',id,'Transfer Presidency');
  }
  document.addEventListener('click', event => {
    const menuButton = event.target.closest('[data-team-menu]');
    const menu = document.getElementById('account-actions');
    if (menuButton && menu) {
      menu.hidden = !menu.hidden;
      menuButton.setAttribute('aria-expanded',String(!menu.hidden));
      if (!menu.hidden) menu.querySelector('button')?.focus();
      return;
    }
    if (menu && !event.target.closest('.team-menu')) {
      menu.hidden = true;
      document.querySelector('[data-team-menu]')?.setAttribute('aria-expanded','false');
    }
    const target = event.target.closest('[data-team-action]');
    if (!target) return;
    const action = target.dataset.teamAction;
    const id = target.dataset.value;
    if (action==='close-dialog') { closeDialog(); return; }
    if (target.dataset.person) {
      if (menu) {menu.hidden = true;document.querySelector('[data-team-menu]')?.setAttribute('aria-expanded','false');}
      accountAction(action,target.dataset.person); return;
    }
    if (!managed(state.role)) return;
    if (menu) {menu.hidden = true; document.querySelector('[data-team-menu]')?.setAttribute('aria-expanded','false');}
    if (action==='setup-tab') {state.tab=id; refresh(); document.querySelector(`[data-team-action="setup-tab"][data-value="${id}"]`)?.focus();}
    if (action==='select-group') {state.group=id; refresh(); document.querySelector(`[data-team-action="select-group"][data-value="${id}"]`)?.focus();}
    if (action==='select-season') {state.season=id; refresh(); document.querySelector(`[data-team-action="select-season"][data-value="${id}"]`)?.focus();}
    if (action==='group-new') openDialog('New group',field('Group name',text('name'))+submit('Create group'),'group-new');
    if (action==='group-delete') {
      const g = state.groups.find(g=>g.id===id);
      if (g) safety(`Delete ${g.name}`,'Removes membership in this group; member accounts and history are retained.','group-delete',id,'Delete group');
    }
    if (action==='invite-new') openDialog('Create invitation',field('Expires in',`<select name="days"><option value="1">1 day</option><option value="7" selected>7 days</option><option value="30">30 days</option></select>`)+submit('Create invitation'),'invite-new');
    if (action==='invite-revoke') safety('Revoke invitation','Stops new signups through this link. Existing accounts are unchanged.','invite-revoke',id,'Revoke invitation');
    if (action==='invite-copy') {
      const i=state.invites.find(i=>i.id===id&&i.status==='Active');
      if (!i) return;
      const link=`https://example.test/invite?code=DESIGN-${i.id}`;
      openDialog('Invitation link',field('Link',`<input id="team-invite-link" readonly value="${link}">`)+`<p class="small muted">Design link · not valid for signup</p><p data-copy-status role="status"></p>${cmd('Copy link','copy-visible-link')}`);
      const control=document.getElementById('team-invite-link'); control.focus(); control.select();
    }
    if (action==='copy-visible-link') {
      const control=document.getElementById('team-invite-link');
      if (control) {
        control.select();
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(control.value).then(()=>{const s=document.querySelector('[data-copy-status]');if(s)s.textContent='Copied';}).catch(()=>{const s=document.querySelector('[data-copy-status]');if(s)s.textContent='Copy the selected link';});
        else document.querySelector('[data-copy-status]').textContent='Copy the selected link';
      }
    }
    if (action==='season-new') openDialog('New season',field('Season name',text('name'))+field('Build target (hours)',number('build',40))+field('Outreach target (hours)',number('outreach',20))+submit('Create season'),'season-new');
    if (action==='season-current') {
      const s=state.seasons.find(s=>s.id===id);
      if(s) safety(`Make ${s.name} current`,'Changes the default season for workflows. Historical records stay in their seasons.','season-current',id,'Make current');
    }
    if (action==='category-new') openDialog('New task category',field('Category name',text('name'))+submit('Create category'),'category-new');
    if (action==='category-delete') {
      const c=state.categories.find(c=>c.id===id);
      if(c&&!c.used) safety(`Delete ${c.name}`,'Removes this unused task category.','category-delete',id,'Delete category');
    }
  });
  document.addEventListener('keydown', event => {
    const menu=document.getElementById('account-actions');
    if (event.key==='Escape' && menu && !menu.hidden) {
      menu.hidden=true;
      const button=document.querySelector('[data-team-menu]');
      button?.setAttribute('aria-expanded','false'); button?.focus();
    }
  });
  document.addEventListener('submit', event => {
    const formElement=event.target.closest('[data-team-form]');
    if (!formElement) return;
    event.preventDefault();
    if (!managed(state.role)) return;
    const data=new FormData(formElement), action=formElement.dataset.teamForm, id=formElement.dataset.id;
    const name=String(data.get('name')||'').trim();
    if (data.has('name')&&!name) {formElement.elements.name.setCustomValidity('Enter a name.');formElement.elements.name.reportValidity();return;}
    const p=people.find(p=>p.id===id);
    let message='Changes saved';
    if (action==='membership') {const g=state.groups.find(g=>g.id===id); if(g)g.members=data.getAll('members');message='Group membership updated';}
    if (action==='group-new') {const id=`group-${Date.now()}`;state.groups.push({id,name,members:[]});state.group=id;message='Group created';}
    if (action==='group-delete') {state.groups=state.groups.filter(g=>g.id!==id);state.group=state.groups[0]?.id;message='Group deleted';}
    if (action==='invite-new') {const days=Number(data.get('days')),expires=new Date();expires.setDate(expires.getDate()+days);state.invites.push({id:String(Date.now()),days,status:'Active',expires:expires.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})});message='Invitation created';}
    if (action==='invite-revoke') {const i=state.invites.find(i=>i.id===id);if(i)i.status='Revoked';message='Invitation revoked';}
    if (action==='season-new') {const id=`season-${Date.now()}`;state.seasons.push({id,name,build:Number(data.get('build')),outreach:Number(data.get('outreach')),cap:6,current:state.seasons.length===0});state.season=id;message='Season created';}
    if (action==='season') {const s=state.seasons.find(s=>s.id===id);if(s)Object.assign(s,{name,build:Number(data.get('build')),outreach:Number(data.get('outreach')),cap:Number(data.get('cap'))});message='Season saved';}
    if (action==='season-current') {state.seasons.forEach(s=>s.current=s.id===id);message='Current season changed';}
    if (action==='category-new') {state.categories.push({id:`category-${Date.now()}`,name});message='Category created';}
    if (action==='category-delete') {state.categories=state.categories.filter(c=>c.id!==id||c.used);message='Category deleted';}
    if (p) {
      if(action==='grants'&&p.status==='active'&&p.role!=='PRESIDENT')p.grants=data.getAll('grants').filter(g=>grantNames.includes(g));
      if(action==='admit'&&p.status==='pending'&&p.verified){p.status='active';p.role=p.display='MEMBER';p.grants=[];}
      if(action==='reject'&&p.status==='pending'){p.status='rejected';message='Prospective account rejected';}
      if(action==='deactivate'&&p.role==='MEMBER')p.status='inactive';
      if(action==='activate'&&p.role==='MEMBER')p.status='active';
      if(state.role==='president'&&p.status==='active'&&p.verified&&p.role!=='PRESIDENT') {
        if(action==='promote'&&p.role==='MEMBER')p.role=String(data.get('admin-role'));
        if(action==='demote')p.role=p.display='MEMBER';
        if(action==='transfer') {
          p.role='PRESIDENT';
          closeDialog();
          const picker=document.getElementById('role');
          if(picker){picker.value='admin';picker.dispatchEvent(new Event('change',{bubbles:true}));}
          state.role='admin';
          refresh('Presidency transferred · current account is now Officer');
          return;
        }
      }
    }
    refresh(message);
  });
  function applyFilter(formElement) {
    const scope=formElement.dataset.teamFilter;
    const data=new FormData(formElement),query=String(data.get('query')||'').toLowerCase().trim(),status=String(data.get('status')||'all');
    let count=0;
    document.querySelectorAll(`[data-team-record="${scope}"]`).forEach(record=>{
      const show=(!query||record.dataset.search.toLowerCase().includes(query))&&(status==='all'||record.dataset.status.split(' ').includes(status));
      record.hidden=!show;if(show)count++;
    });
    const empty=document.querySelector(`[data-team-empty="${scope}"]`);if(empty)empty.hidden=count>0;
  }
  document.addEventListener('input',event=>{
    if(event.target.name==='name')event.target.setCustomValidity('');
    const f=event.target.closest('[data-team-filter]');if(f)applyFilter(f);
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='role'){state.role=event.target.value;closeDialog();}
    const f=event.target.closest('[data-team-filter]');if(f)applyFilter(f);
  });
  document.addEventListener('submit',event=>{const f=event.target.closest('[data-team-filter]');if(f){event.preventDefault();applyFilter(f);}});
  document.addEventListener('reset',event=>{if(event.target.matches('[data-team-filter]'))setTimeout(()=>applyFilter(event.target),0);});
  window.addEventListener('hashchange',closeDialog);
})();
