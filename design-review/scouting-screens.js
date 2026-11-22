/* Standalone design-review screens. All records and interactions are illustrative. */
(() => {
  const U = window.U;
  const S = window.screens;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const managing = (role) => role === 'admin' || role === 'president';
  const state = { event: 'scrimmage', match: 13, team: 254, alliance: 'red', editing: false };
  const events = { scrimmage: 'Optix Fall Scrimmage', invitational: 'Bay Area Invitational' };
  const eventName = () => events[state.event];
  const teams = [
    { team: 254, matches: 6, total: 18, auto: 3.5, tele: 14.5, accuracy: 90, climb: 83, driver: 4.5, defense: 3.0, died: 0 },
    { team: 971, matches: 6, total: 16.2, auto: 3.0, tele: 13.2, accuracy: 86, climb: 67, driver: 4.3, defense: 4.0, died: 0 },
    { team: 1678, matches: 5, total: 15.6, auto: 2.8, tele: 12.8, accuracy: 84, climb: 80, driver: 4.4, defense: 2.8, died: 1 },
    { team: 4414, matches: 5, total: 13.8, auto: 2.6, tele: 11.2, accuracy: 81, climb: 60, driver: 4.0, defense: 3.6, died: 0 }
  ];
  const entries = [
    { id: 'sample-match-254-q12-alex', match: 12, team: 254, scout: 'Alex Chen', own: true, alliance: 'red', auto: 4, tele: 15, missed: 2, endgame: 'high', notes: 'Clean center start. Recovered quickly after a missed pickup.', time: '2026-11-07T10:42:00' },
    { id: 'sample-match-254-q9-maya', match: 9, team: 254, scout: 'Maya Patel', own: false, alliance: 'blue', auto: 3, tele: 14, missed: 2, endgame: 'high', notes: 'Consistent cycles; no defense faced.', time: '2026-11-07T10:18:00' },
    { id: 'sample-match-254-q6-jordan', match: 6, team: 254, scout: 'Jordan Lee', own: false, alliance: 'red', auto: 4, tele: 16, missed: 2, endgame: 'low', notes: 'Switched to low climb late.', time: '2026-11-07T09:54:00' }
  ];
  const field = (label, control, hint = '') => U.field(label, control, hint);
  const input = (name, value, type = 'text', extra = '') => `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
  const select = (name, options, value, extra = '') => `<select name="${name}" ${extra}>${options.map(([v, l]) => `<option value="${v}" ${String(value) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const num = (label, name, value = 0, max = '') => field(label, input(name, value, 'number', `min="0" step="1" inputmode="numeric" ${max ? `max="${max}"` : ''}`));
  const toggle = (label, name, checked = false) => `<label class="checkline"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}> ${label}</label>`;
  const choice = (label, name, options, value) => field(label, select(name, options, value));
  const note = (text) => `<div class="notice info">${text}</div>`;
  const tools = (role) => managing(role) ? U.button('Manage this event', 'scout-manage') : '';
  const tabs = (active, role) => U.tabs([['Overview', 'scouting'], ['Match entry', 'scout-match'], ['Pit report', 'scout-pit'], ['Team data', 'scout-teams'], ...(managing(role) ? [['Manage event', 'scout-manage']] : [])], active);
  const picker = () => field('Viewing event', select('scout_event', [['scrimmage', 'Optix Fall Scrimmage · active'], ['invitational', 'Bay Area Invitational · archived sample']], state.event, 'data-scout-event'), 'Sample events · active event is the default; selecting another does not make it active.');
  const context = () => `<div class="toolbar">${picker()}<p class="small muted" data-scout-event-name>${esc(eventName())} · 2026–27 season</p></div>`;
  const metric = (label, value) => `<div class="metric"><span class="small muted">${label}</span><strong>${value}</strong></div>`;
  const endgames = [['none', 'None'], ['park', 'Park'], ['low', 'Low climb'], ['high', 'High climb'], ['failed', 'Failed attempt']];
  const editLink = (label, match, team, editing = false, alliance = 'red') => `<a class="button ${editing ? '' : 'primary'}" href="#scout-match" data-scout-record="${match},${team},${alliance},${editing}">${label}</a>`;
  const teamLink = (team) => `<a href="#scout-team" data-scout-team="${team}">${team}</a>`;
  const pathGraphic = (points = '12,72 29,72 43,50 61,50', label = 'Sample autonomous route', extra = '') => `<svg viewBox="0 0 100 100" role="img" aria-label="${label}" ${extra} style="display:block;width:100%;max-width:420px;aspect-ratio:1.5;background:var(--raised,#edf0e8);border:1px solid currentColor;border-radius:8px;color:var(--accent,#315d32);touch-action:none"><rect x="2" y="2" width="96" height="96" fill="none" stroke="currentColor" opacity=".35"/><path d="M50 2V98" stroke="currentColor" stroke-dasharray="2 3" opacity=".35"/><polyline data-path-line points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle data-path-marker cx="12" cy="72" r="3" fill="none" stroke="currentColor"/><circle data-path-marker cx="61" cy="50" r="2" fill="currentColor"/><text x="5" y="12" fill="currentColor" font-size="5">RED-SIDE REFERENCE</text></svg>`;
  const pathEditor = (name, planned = false) => `<div class="stack" data-path-editor="${name}">
    <p class="small muted">${planned ? 'Ask the team to describe or sketch its main routine.' : 'Mark the start, then trace the route you observed.'} Simplified field, not a game-specific field image.</p>
    ${pathGraphic('12,72 29,72 43,50 61,50', `${planned ? 'Planned' : 'Observed'} auto path drawing area. Pointer or coordinate controls below.`, 'data-scout-path tabindex="0"')}
    <p class="small muted">Pointer: tap or drag to add points. Keyboard alternative: enter X and Y percentages, then Add point. Paths use normalized field coordinates; red is left.</p>
    <div class="form-grid">${field('X position (%)', input(`${name}_x`, 65, 'number', 'min="0" max="100" data-path-x'))}${field('Y position (%)', input(`${name}_y`, 35, 'number', 'min="0" max="100" data-path-y'))}</div>
    <div class="actions"><button type="button" class="button" data-path-add>Add point</button><button type="button" class="button" data-path-stroke>New stroke</button><button type="button" class="button" data-path-undo>Undo point</button><button type="button" class="button" data-path-clear>Clear path</button></div>
    <input type="hidden" name="${name}" value="[[[0.12,0.72],[0.29,0.72],[0.43,0.5],[0.61,0.5]]]">
    <p class="small" role="status" data-path-status>Sample path · 1 stroke, 4 points. This drawing is not saved to a server.</p>
  </div>`;
  const steps = (name, panels) => `<div data-scout-steps="${name}" class="stack">${panels.map(([title, body], i) => `<details class="panel" data-scout-step="${i}" ${i === 0 ? 'open' : ''}><summary><strong>${i + 1}. ${title}</strong></summary><div class="stack">${body}<div class="actions">${i ? `<button type="button" class="button" data-scout-step-to="${i - 1}">Back</button>` : ''}${i < panels.length - 1 ? `<button type="button" class="button primary" data-scout-step-to="${i + 1}">Next: ${panels[i + 1][0]}</button>` : ''}</div></div></details>`).join('')}</div>`;

  S.scouting = ({ role }) => `${U.head('Competition workspace', 'Scouting', 'Know your station, record one robot, and leave the next scout a clear handoff.', tools(role))}${tabs('scouting', role)}${context()}
    ${note('Sample competition day · November 7, 2026. Event counts and records are illustrative, not live coverage.')}
    <div class="metrics">${metric('Match entries', '132')}${metric('Teams seen', '24')}${metric('Pit reports', '18')}${metric('Your pending assignments', '2')}</div>
    <div class="split"><section class="panel stack"><div class="section-head"><div><h2>Your next assignment</h2><p class="muted">Q13 · Red 1 · Team 254</p></div>${U.badge('Ready to start', 'warning')}</div><p>Observe only team 254. Verify the team number at the station before entering the autonomous period.</p>${editLink('Start Q13 · Team 254', 13, 254)}<div class="divider"></div><h3>Up next</h3><div class="row"><div class="row-main"><strong>Q14 · Blue 2 · Team 971</strong><p class="row-meta">Scheduled 11:06 AM · Not submitted</p></div>${editLink('Start Q14', 14, 971, false, 'blue')}</div><p class="small muted">Assignments are tied to a match and alliance station. Completion is based on your entry for that match and team, not another scout’s report.</p></section>
    <section class="panel stack"><h2>Other scouting work</h2>${U.button('Start an unassigned match', 'scout-match')}${U.button('Record a pit report', 'scout-pit')}${U.button('Explore team data', 'scout-teams')}<p class="small muted">Assignments help coordinate coverage; members can still scout an unassigned match.</p></section></div>
    <section class="panel"><h2>Your recent entries</h2><div class="row"><div class="row-main"><strong>Q12 · Team 254 · Red</strong><p class="row-meta">Submitted by you · 10:42 AM · 19 pieces scored</p></div>${editLink('Edit your entry', 12, 254, true)}</div><div class="row"><div class="row-main"><strong>Pit report · Team 254</strong><p class="row-meta">Submitted by you · 9:12 AM · Swerve / high climb</p></div>${U.button('Continue pit report', 'scout-pit')}</div></section>
    <details class="panel"><summary>When no event or assignment is available</summary><p>No event: ${managing(role) ? 'Create an event in Manage event.' : 'A scouting manager will set up the event before competition.'} No assignment: use Match entry or Pit report; do not infer an assignment from another scout’s work.</p></details>`;

  S['scout-match'] = ({ role }) => {
    const old = state.editing;
    return `${U.head('Scouting / Match entry', old ? 'Update your match entry' : 'Scout one robot', 'Move through the match in order. You can reopen any section before submitting.', U.button('Back to scouting', 'scouting'))}${tabs('scout-match', role)}
    ${note(`${esc(eventName())} · ${old ? 'Editing your previously submitted Q12 report. The same event / match / team / scout record will be updated.' : 'New sample entry. No draft or offline synchronization is implied; fields remain only in this open prototype.'}`)}
    <form data-demo-form="Sample match entry submitted. No live scouting record changed." data-scout-match-form class="stack">
    <section class="panel stack"><h2>Confirm the robot</h2><div class="form-grid">${choice('Match type', 'match_type', [['pm', 'Practice'], ['qm', 'Qualification'], ['sf', 'Semifinal'], ['f', 'Final']], 'qm')}${field('Match number', input('match_number', state.match, 'number', 'required min="1" step="1" inputmode="numeric"'))}${field('Team number', input('team_number', state.team, 'number', 'required min="1" step="1" inputmode="numeric"'))}${choice('Alliance', 'alliance', [['', 'Not specified'], ['red', 'Red'], ['blue', 'Blue']], state.alliance)}</div><details><summary>Choose from the sample match schedule</summary><p class="small muted">Q13 scheduled teams. Selecting a team also sets its alliance.</p><div class="actions">${[[254, 'red'], [1678, 'red'], [4414, 'red'], [971, 'blue'], [1323, 'blue'], [604, 'blue']].map(([t, a]) => `<button class="button" type="button" data-scout-robot="${t},${a}">${a === 'red' ? 'Red' : 'Blue'} · ${t}</button>`).join('')}</div></details><p class="small muted">Scout: Alex Chen (you) · An earlier entry for this same identity is updated, not duplicated.</p></section>
    ${steps('match', [
      ['Autonomous', `<div class="form-grid">${num('Pieces scored', 'auto_scored', old ? 4 : 0)}${num('Pieces missed', 'auto_missed', old ? 1 : 0)}</div>${toggle('Left starting zone', 'auto_leave', old)}<details><summary>Auto path · draw the observed routine</summary>${pathEditor('auto_path')}</details>`],
      ['Teleop', `<div class="form-grid">${num('Pieces scored', 'tele_scored', old ? 15 : 0)}${num('Pieces missed', 'tele_missed', old ? 1 : 0)}${num('Floor pickups', 'tele_pickups', old ? 17 : 0)}</div>`],
      ['Endgame', choice('Endgame result', 'endgame', endgames, old ? 'high' : 'none')],
      ['Performance', `<div class="form-grid">${choice('Driver skill', 'driver', [['', 'Not rated'], [1, '1 / 5'], [2, '2 / 5'], [3, '3 / 5'], [4, '4 / 5'], [5, '5 / 5']], old ? 5 : '')}${choice('Defense played', 'defense', [['', 'Not rated'], [1, '1 / 5'], [2, '2 / 5'], [3, '3 / 5'], [4, '4 / 5'], [5, '5 / 5']], old ? 3 : '')}${num('Fouls', 'fouls', 0)}</div>${toggle('Robot died / disabled', 'died')}${toggle('Tipped over', 'tipped')}`],
      ['Review & submit', `${field('Observation notes', `<textarea name="notes" rows="4" placeholder="What would an alliance partner need to know?">${old ? esc(entries[0].notes) : ''}</textarea>`)}<p class="small muted">Check the event, match number, team and alliance above. Distinguish an observed zero from a rating you did not make. Each scout’s report stays separate.</p><button type="submit" class="button primary">${old ? 'Update your match entry' : 'Submit match entry'}</button>`]
    ])}<div class="notice info" data-scout-confirmation role="status" hidden></div></form>`;
  };

  S['scout-pit'] = ({ role }) => `${U.head('Scouting / Pit report', 'Talk to the drive team', 'Capture stated capabilities separately from observed match performance.', U.button('Team data', 'scout-teams'))}${tabs('scout-pit', role)}${note(`${esc(eventName())} · Your existing team ${state.team} pit report is shown as a sample. Updating it never overwrites a different scout’s report.`)}
    <form class="stack" data-demo-form="Sample pit report updated for Alex Chen. No live record changed." data-scout-pit-form><section class="panel">${field('Team number', input('team_number', state.team, 'number', 'required min="1" inputmode="numeric"'))}<p class="small muted">Scout: Alex Chen · Report identity: event + team + scout. You have pit-scouted teams 254 and 971.</p></section>
    ${steps('pit', [
      ['Robot', `<div class="form-grid">${choice('Drivetrain', 'drivetrain', [['swerve', 'Swerve'], ['tank', 'Tank / West coast'], ['mecanum', 'Mecanum'], ['other', 'Other']], 'swerve')}${field('Weight (lb)', input('weight', 117, 'number', 'min="0" step="any"'))}${field('Top speed (ft/s)', input('speed', 16.5, 'number', 'min="0" step="any"'))}${field('Scoring mechanisms', input('mechanisms', 'Floor intake, indexer, adjustable shooter'))}</div>`],
      ['Capabilities', `<div class="form-grid">${field('Auto routines', input('auto_routines', 'Three-piece center; two-piece from either side'))}${choice('Endgame capability', 'endgame', endgames.filter(([v]) => v !== 'failed'), 'high')}${field('Preferred start position', input('start_position', 'Center; can start left if needed'))}</div>${toggle('Willing to play defense', 'plays_defense', true)}<details><summary>Planned auto path · sketch with the team</summary>${pathEditor('planned_auto', true)}</details>`],
      ['Review & save', `${field('Pit notes', '<textarea name="notes" rows="4">Team reports reliable high climb in practice. Confirm under defense during matches. Spare intake rollers available.</textarea>')}<p class="small muted">These are the team’s claims, not measured match results. Keep useful context in the notes.</p><button type="submit" class="button primary">Update your pit report</button>`]
    ])}<div class="notice info" data-scout-confirmation role="status" hidden></div></form>`;

  const teamTable = (rows = teams) => `<div class="table-wrap"><table class="data-table" data-scout-team-table><caption>Sample team performance · averages per scouting report, not official scores</caption><thead><tr>${[['team', 'Team'], ['matches', 'Reports'], ['total', 'Avg scored'], ['auto', 'Auto'], ['tele', 'Teleop'], ['accuracy', 'Accuracy'], ['climb', 'Climb'], ['driver', 'Driver'], ['defense', 'Defense'], ['died', 'Died']].map(([key, label]) => `<th scope="col" ${key === 'total' ? 'aria-sort="descending"' : ''}><button type="button" class="text-link" data-scout-sort="${key}">${label}${key === 'total' ? ' ↓' : ''}</button></th>`).join('')}</tr></thead><tbody>${rows.map((t) => `<tr data-team-number="${t.team}">${[teamLink(t.team), t.matches, t.total.toFixed(1), t.auto.toFixed(1), t.tele.toFixed(1), `${t.accuracy}%`, `${t.climb}%`, t.driver.toFixed(1), t.defense.toFixed(1), t.died].map((v, i) => i === 0 ? `<th scope="row">${v}</th>` : `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  S['scout-teams'] = ({ role }) => `${U.head('Scouting / Team data', 'Find the evidence, not just the average', 'Browse scouting reports for the selected event. A report count is not necessarily a count of unique matches.', '<button class="button" type="button" data-scout-export>Export raw CSV</button>')}${tabs('scout-teams', role)}${context()}<section class="panel stack"><div class="toolbar">${field('Filter by team number', '<input name="team_filter" type="search" inputmode="numeric" placeholder="e.g. 254" data-scout-filter>')}<p class="small muted" role="status" data-scout-filter-status>4 illustrative teams · Sorted by average scored, highest first</p></div>${teamTable()}<p class="small muted">Scroll horizontally on narrow screens. Column headers sort numerically; select a team number for the full report. “Climb” means low or high climb; accuracy is scored / (scored + missed).</p></section><details class="panel"><summary>What the CSV contains</summary><p>Raw match reports, not the averaged table: match type, number, team, alliance, scout, every current match field, notes and submission time. Path data is serialized as JSON. This prototype downloads three clearly labeled sample reports only.</p><button type="button" class="button" data-scout-export>Download sample raw CSV</button></details>`;

  S['scout-team'] = ({ role }) => {
    const team = state.team;
    const t = teams.find((r) => r.team === team) || teams[0];
    const reports = team === 254 ? entries : entries.slice(0, 2).map((e) => ({ ...e, team, id: `${e.id}-${team}` }));
    return `${U.head('Scouting / Team detail', `Team ${team}`, `${esc(eventName())} · Sample evidence review`, `${U.button('All teams', 'scout-teams')}${U.button('Pit scout this team', 'scout-pit')}${editLink('Match scout this team', 13, team)}`)}${note('Illustrative scouting records. Counts include individual scout reports; they are not official results or an official match feed.')}
      <div class="metrics">${metric('Reports', t.matches)}${metric('Avg scored', t.total.toFixed(1))}${metric('Auto / Teleop', `${t.auto.toFixed(1)} / ${t.tele.toFixed(1)}`)}${metric('Accuracy', `${t.accuracy}%`)}${metric('Climb rate', `${t.climb}%`)}${metric('Left zone', '100%')}${metric('Driver / Defense', `${t.driver.toFixed(1)} / ${t.defense.toFixed(1)}`)}${metric('Died', t.died)}</div>
      <section class="panel stack"><h2>Autonomous paths</h2><p class="small muted">Shown from the red side · hollow circle = start · filled circle = end. Blue paths use the current left/right mirror convention.</p><div class="columns"><div data-scout-path-review>${pathGraphic('12,72 29,72 43,50 61,50', 'Observed Q12 auto route')}<p role="status" data-scout-path-caption>Observed Q12 · Alex Chen · red alliance</p><div class="actions">${reports.map((r, i) => `<button type="button" class="button" data-scout-path-focus="${i}" aria-pressed="${i === 0}">Q${r.match}</button>`).join('')}<button type="button" class="button" data-scout-path-focus="all" aria-pressed="false">Overlay all</button></div></div><div><h3>Planned in pit report</h3>${pathGraphic('12,72 29,72 43,50 66,50', 'Planned main autonomous routine')}<p class="small muted">Alex Chen · Three-piece center. Compare the planned route with observed runs; the prototype uses schematic sample coordinates.</p></div></div></section>
      <section class="panel stack"><h2>Pit reports</h2><details open><summary>Alex Chen · November 7, 9:12 AM · Your report</summary><dl class="form-grid"><div><dt>Drivetrain</dt><dd>Swerve</dd></div><div><dt>Weight / top speed</dt><dd>117 lb / 16.5 ft/s</dd></div><div><dt>Scoring mechanisms</dt><dd>Floor intake, indexer, adjustable shooter</dd></div><div><dt>Auto routines</dt><dd>Three-piece center; two-piece sides</dd></div><div><dt>Endgame</dt><dd>High climb</dd></div><div><dt>Plays defense</dt><dd>Yes</dd></div><div><dt>Preferred start</dt><dd>Center; flexible to left</dd></div></dl><p>Team reports reliable high climb in practice. Confirm in match observations.</p>${U.button('Edit your pit report', 'scout-pit')}</details><details><summary>Maya Patel · November 7, 9:25 AM · Separate report</summary><p>Swerve · 117 lb · 16 ft/s · Floor intake / shooter · Two-piece side auto · High climb · Defense: yes · Preferred start: center.</p><p>Driver says they can adapt the starting location with advance notice.</p><p class="small muted">This is Maya’s report. Your pit entry does not replace it.</p></details></section>
      <section class="panel stack"><div class="section-head"><h2>Match history</h2><button type="button" class="button" data-scout-export>Export sample raw CSV</button></div><p class="small muted">Expand a report for every field and observation notes. Only your own report opens in your entry form. ${managing(role) ? 'The selected manager persona has the manage_scouting grant and may remove incorrect reports.' : 'Other scouts’ records remain read-only.'}</p>${reports.map((r) => `<details data-scout-history="${r.id}"><summary>Q${r.match} · ${r.auto + r.tele} pieces · ${r.scout}${r.own ? ' (you)' : ''} · ${r.alliance}</summary><dl class="form-grid"><div><dt>Autonomous</dt><dd>Left zone: yes · ${r.auto} scored / 1 missed</dd></div><div><dt>Teleop</dt><dd>${r.tele} scored / 1 missed · ${r.tele + 2} floor pickups</dd></div><div><dt>Endgame</dt><dd>${r.endgame === 'high' ? 'High climb' : 'Low climb'}</dd></div><div><dt>Performance</dt><dd>Driver: 5/5 · Defense: 3/5 · Fouls: 0 · Died: no · Tipped: no</dd></div></dl><p>${esc(r.notes)}</p><p class="small muted">Record: ${r.id} · Updated ${r.time.replace('T', ' ')}</p><div class="actions">${r.own ? editLink('Edit your report', r.match, team, true, r.alliance) : ''}${r.own || managing(role) ? `<button type="button" class="button" data-scout-delete-open>Delete this match report</button>` : ''}</div>${r.own || managing(role) ? `<form hidden data-demo-form="Sample match report removed from this view only. No live record changed." data-scout-delete-form><p class="notice warning">Delete Q${r.match}, team ${team}, by ${r.scout}? This targets only this record. In the real application deletion cannot be undone.</p><button class="button" type="button" data-scout-delete-cancel>Cancel</button> <button class="button" type="submit">Confirm deletion in sample</button></form>` : ''}</details>`).join('')}</section>`;
  };

  S['scout-manage'] = ({ role }) => {
    if (!managing(role)) return `${U.head('Scouting', 'Scouting management is permission-limited', 'The manage_scouting grant is required. A leadership title or an assignment does not grant event management.', U.button('Back to scouting', 'scouting'))}`;
    return `${U.head('Scouting / Manage event', 'Coverage before complexity', 'Set up the event, import its schedule, then put a scout at each station.', U.button('Member overview', 'scouting'))}${tabs('scout-manage', role)}${context()}${note('Permission preview: this manager persona has manage_scouting. President has implicit permission. Member and assigned-lead previews do not show these tools.')}
      <section class="panel stack"><div class="section-head"><div><h2 data-scout-event-name>${esc(eventName())}</h2><p class="muted">2026–27 · November 7–8 · 24 scheduled matches · 138 of 144 stations assigned</p></div>${U.badge(state.event === 'scrimmage' ? 'Active default' : 'Not active', state.event === 'scrimmage' ? 'success' : 'neutral')}</div><p>Active controls which event members see by default. Simply viewing an archive does not activate it.</p><form data-demo-form="Sample selected event made active. No live event changed."><button class="button" type="submit">Make selected event active (sample)</button></form>
      <details><summary>Create an event</summary><form class="stack" data-demo-form="Sample event created. No live event changed."><div class="form-grid">${field('Event name', input('name', '', 'text', 'required placeholder="Optix Winter Scrimmage"'))}${field('Event code (optional)', input('event_code', '', 'text', 'placeholder="2026optixwinter"'))}${field('Start date', input('starts_on', '', 'date'))}${field('End date', input('ends_on', '', 'date'))}</div><p class="small muted">Uses the current season. The first event is active by default; later events are not.</p><button class="button primary" type="submit">Create sample event</button></form></details></section>
      <section class="panel stack"><h2>1. Import the match schedule</h2><p>Paste from a spreadsheet: match number, Red 1–3, then Blue 1–3. Commas, tabs and spaces are accepted. Each nonempty row must contain seven numbers.</p><form class="stack" data-demo-form="Sample schedule preview accepted. No live schedule changed." data-scout-import-form>${choice('Match type for this import', 'import_type', [['pm', 'Practice'], ['qm', 'Qualification'], ['sf', 'Semifinal'], ['f', 'Final']], 'qm')}${field('Schedule rows', '<textarea name="schedule_text" rows="4" required spellcheck="false">13,254,1678,4414,971,1323,604\n14,604,254,1323,4414,971,1678</textarea>', 'No column header. Existing rows are matched by event + match type + match number. Re-importing updates teams on those matches.')}<button class="button" type="button" data-scout-import-preview>Preview these rows</button><div data-scout-import-result aria-live="polite"></div><button class="button primary" type="submit">Import sample schedule</button></form></section>
      <section class="panel stack"><h2>2. Assign the stations</h2><p>Assignments belong to a match + station. Leave a station unassigned by choosing “Unassigned.” Team numbers come from the imported match schedule.</p><form class="stack" data-demo-form="Sample Q13 station assignments updated. No live assignments changed."><h3>Q13 · 11:00 AM</h3><div class="form-grid">${[['red1', 254, 'Alex Chen'], ['red2', 1678, 'Maya Patel'], ['red3', 4414, 'Jordan Lee'], ['blue1', 971, 'Sam Rivera'], ['blue2', 1323, 'Taylor Kim'], ['blue3', 604, '']].map(([station, team, scout]) => choice(`${station.replace(/(red|blue)(\d)/, '$1 $2')} · Team ${team}`, station, [['', 'Unassigned'], ...['Alex Chen', 'Maya Patel', 'Jordan Lee', 'Sam Rivera', 'Taylor Kim', 'Casey Park'].map((n) => [n, n])], scout)).join('')}</div><button class="button primary" type="submit">Save sample assignments</button></form>
      <details><summary>Fill empty stations from a scout pool</summary><form class="stack" data-demo-form="Sample empty stations assigned from the selected pool. Existing assignments preserved." data-scout-autoassign><p>Round-robin in match order. Existing assignments remain intact; one scout is not assigned two stations in the same match. Stations stay empty when the pool has no available scout.</p><div class="form-grid">${['Alex Chen', 'Maya Patel', 'Jordan Lee', 'Sam Rivera', 'Taylor Kim', 'Casey Park'].map((n, i) => toggle(`${n} · ${i < 5 ? 23 : 0} assignments`, 'pool', i === 5).replace('name="pool"', `name="pool" value="${n}"`)).join('')}</div><button class="button" type="submit">Fill sample empty stations</button></form></details>
      <details><summary>Clear all event assignments</summary><form data-demo-form="Sample assignments cleared in this preview only. No live data changed."><p class="notice warning">Remove every scout assignment for the selected event? Match schedules and scouting reports remain.</p><label class="checkline"><input type="checkbox" required name="confirm_clear"> I understand all event stations will be unassigned.</label><button class="button" type="submit">Confirm clearing sample assignments</button></form></details></section>
      <details class="panel"><summary>Delete selected event and its scouting data</summary><form class="stack" data-demo-form="Sample event deletion confirmed. No live event or records changed." data-scout-event-delete><p class="notice warning">Deleting an event also deletes its scouting data. This is not the same as switching events or clearing assignments.</p>${field('Type the selected event name to confirm', input('confirm_event_name', '', 'text', 'required autocomplete="off"'))}<button class="button" type="submit">Delete event (sample)</button></form></details>`;
  };

  // These listeners only touch sample markup owned by this script.
  const show = (form, text) => {
    const box = form.querySelector('[data-scout-confirmation]');
    if (box) { box.hidden = false; box.textContent = text; box.tabIndex = -1; box.focus(); }
  };
  const paths = new WeakMap();
  const getPath = (editor) => {
    if (!paths.has(editor)) paths.set(editor, [[[12, 72], [29, 72], [43, 50], [61, 50]]]);
    return paths.get(editor);
  };
  const paint = (editor) => {
    const strokes = getPath(editor);
    const svg = editor.querySelector('svg');
    svg.querySelectorAll('[data-path-line], [data-path-marker]').forEach((n) => n.remove());
    const ns = 'http://www.w3.org/2000/svg';
    for (const stroke of strokes.filter((p) => p.length)) {
      const p = document.createElementNS(ns, 'polyline');
      p.setAttribute('points', stroke.map((v) => v.join(',')).join(' ')); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2'); p.dataset.pathLine = ''; svg.append(p);
      for (const [i, point] of [stroke[0], stroke[stroke.length - 1]].entries()) {
        const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', point[0]); c.setAttribute('cy', point[1]); c.setAttribute('r', '2'); c.setAttribute('stroke', 'currentColor'); c.setAttribute('fill', i ? 'currentColor' : 'none'); c.dataset.pathMarker = ''; svg.append(c);
      }
    }
    editor.querySelector('input[type="hidden"]').value = JSON.stringify(strokes.filter((p) => p.length).map((s) => s.map(([x, y]) => [x / 100, y / 100])));
    editor.querySelector('[data-path-status]').textContent = `${strokes.filter((s) => s.length).length} strokes · ${strokes.reduce((n, s) => n + s.length, 0)} points · sample only`;
  };
  const addPoint = (editor, x, y) => { const strokes = getPath(editor); if (!strokes.length) strokes.push([]); strokes[strokes.length - 1].push([Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y))]); paint(editor); };
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const exportSample = () => {
    const headers = ['match_type', 'match', 'team', 'alliance', 'scout', 'auto_path', 'auto_leave', 'auto_scored', 'auto_missed', 'tele_scored', 'tele_missed', 'tele_pickups', 'endgame', 'driver', 'defense', 'fouls', 'died', 'tipped', 'notes', 'submitted'];
    const rows = entries.map((r) => ['qm', r.match, r.team, r.alliance, r.scout, '[[[0.12,0.72],[0.29,0.72],[0.43,0.5],[0.61,0.5]]]', true, r.auto, 1, r.tele, 1, r.tele + 2, r.endgame, 5, 3, 0, false, false, r.notes, r.time]);
    const blob = new Blob([[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'SAMPLE-scouting-optix-fall-scrimmage.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const parseImport = (form) => {
    const rows = []; const errors = [];
    form.elements.schedule_text.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((line, i) => {
      const nums = (line.match(/\d+/g) || []).map(Number);
      if (nums.length !== 7) errors.push(`Line ${i + 1}: expected 7 numbers, got ${nums.length}`); else rows.push(nums);
    });
    if (!rows.length && !errors.length) errors.push('Paste at least one match.');
    const result = form.querySelector('[data-scout-import-result]');
    result.innerHTML = errors.length ? `<div class="notice warning">${errors.map(esc).join('<br>')}</div>` : `<div class="table-wrap"><table class="data-table"><caption>${rows.length} sample matches ready · ${esc(form.elements.import_type.selectedOptions[0].textContent)}</caption><thead><tr>${['Match', 'Red 1', 'Red 2', 'Red 3', 'Blue 1', 'Blue 2', 'Blue 3'].map((v) => `<th scope="col">${v}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return errors.length === 0;
  };
  document.addEventListener('click', (event) => {
    const t = event.target.closest('button,a'); if (!t) return;
    if (t.hasAttribute('data-scout-record')) { const [match, team, alliance, editing] = t.dataset.scoutRecord.split(','); Object.assign(state, { match: Number(match), team: Number(team), alliance, editing: editing === 'true' }); if (location.hash === '#scout-match') window.renderPrototype?.(); }
    if (t.hasAttribute('data-scout-team')) state.team = Number(t.dataset.scoutTeam);
    if (t.hasAttribute('data-scout-step-to')) { const root = t.closest('[data-scout-steps]'); root.querySelectorAll('[data-scout-step]').forEach((d) => { d.open = d.dataset.scoutStep === t.dataset.scoutStepTo; }); const next = root.querySelector(`[data-scout-step="${t.dataset.scoutStepTo}"]`); next.querySelector('summary').focus(); next.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    if (t.hasAttribute('data-scout-robot')) { const [team, alliance] = t.dataset.scoutRobot.split(','); t.form.elements.team_number.value = team; t.form.elements.alliance.value = alliance; }
    if (t.hasAttribute('data-scout-export')) exportSample();
    if (t.hasAttribute('data-scout-import-preview')) parseImport(t.form);
    if (t.hasAttribute('data-scout-delete-open')) t.closest('details').querySelector('[data-scout-delete-form]').hidden = false;
    if (t.hasAttribute('data-scout-delete-cancel')) t.form.hidden = true;
    if (t.hasAttribute('data-scout-sort')) {
      const table = t.closest('table'); const key = t.dataset.scoutSort; const direction = t.closest('th').getAttribute('aria-sort') === 'descending' ? 1 : -1;
      table.querySelectorAll('th[aria-sort]').forEach((h) => h.removeAttribute('aria-sort')); t.closest('th').setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending');
      const values = new Map(teams.map((r) => [String(r.team), r[key]])); const rows = [...table.tBodies[0].rows]; rows.sort((a, b) => direction * (values.get(a.dataset.teamNumber) - values.get(b.dataset.teamNumber))); rows.forEach((r) => table.tBodies[0].append(r));
      table.querySelectorAll('[data-scout-sort]').forEach((b) => { b.textContent = b.textContent.replace(/ [↓↑]$/, '') + (b === t ? direction === 1 ? ' ↑' : ' ↓' : ''); });
    }
    if (t.hasAttribute('data-scout-path-focus')) {
      const root = t.closest('[data-scout-path-review]'); const i = t.dataset.scoutPathFocus;
      const points = ['12,72 29,72 43,50 61,50', '14,65 30,64 46,43 62,45', '11,76 27,74 42,55 61,54'];
      root.querySelector('svg').outerHTML = i === 'all' ? pathGraphic(points[0], 'All sample autonomous routes overlaid').replace('</svg>', points.slice(1).map((p) => `<polyline points="${p}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>`).join('') + '</svg>') : pathGraphic(points[Number(i)], `Sample autonomous route Q${entries[Number(i)].match}`);
      root.querySelector('[data-scout-path-caption]').textContent = i === 'all' ? 'All three observed sample paths · red-side reference' : `Observed Q${entries[Number(i)].match} · ${entries[Number(i)].scout} · ${entries[Number(i)].alliance} alliance`;
      root.querySelectorAll('[data-scout-path-focus]').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
    }
    const editor = t.closest('[data-path-editor]');
    if (editor) {
      if (t.hasAttribute('data-path-add')) { const x = editor.querySelector('[data-path-x]'); const y = editor.querySelector('[data-path-y]'); if (x.reportValidity() && y.reportValidity() && x.value !== '' && y.value !== '') addPoint(editor, Number(x.value), Number(y.value)); }
      if (t.hasAttribute('data-path-clear')) { paths.set(editor, []); paint(editor); }
      if (t.hasAttribute('data-path-stroke')) { const strokes = getPath(editor); if (strokes.length && strokes[strokes.length - 1].length) strokes.push([]); paint(editor); }
      if (t.hasAttribute('data-path-undo')) { const strokes = getPath(editor); while (strokes.length && !strokes[strokes.length - 1].length) strokes.pop(); if (strokes.length) strokes[strokes.length - 1].pop(); paint(editor); }
    }
  });
  document.addEventListener('input', (event) => {
    if (!event.target.matches('[data-scout-filter]')) return;
    const q = event.target.value.trim(); let count = 0;
    document.querySelectorAll('[data-team-number]').forEach((r) => { r.hidden = !r.dataset.teamNumber.includes(q); if (!r.hidden) count++; });
    const status = document.querySelector('[data-scout-filter-status]'); if (status) status.textContent = `${count} illustrative team${count === 1 ? '' : 's'} shown${!count ? ' · No team numbers match. Clear the filter to show all.' : ''}`;
  });
  document.addEventListener('change', (event) => {
    if (!event.target.matches('[data-scout-event]')) return;
    state.event = event.target.value;
    if (window.renderPrototype) window.renderPrototype();
    document.querySelectorAll('[data-scout-event-name]').forEach((n) => { n.textContent = `${eventName()} · Sample data`; });
    const status = document.createElement('p'); status.className = 'notice info'; status.setAttribute('role', 'status'); status.textContent = `${eventName()} selected in this prototype. The displayed records remain the same illustrative dataset; no production event was changed.`;
    const toolbar = document.querySelector('[data-scout-event]')?.closest('.toolbar'); if (toolbar) { toolbar.querySelector('[data-scout-event-change]')?.remove(); status.dataset.scoutEventChange = ''; toolbar.append(status); }
  });
  let drawing = null;
  const drawAt = (event) => { if (!drawing) return; const rect = drawing.svg.getBoundingClientRect(); addPoint(drawing.editor, (event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100); };
  document.addEventListener('pointerdown', (event) => { const svg = event.target.closest('[data-scout-path]'); if (!svg) return; drawing = { svg, editor: svg.closest('[data-path-editor]') }; svg.setPointerCapture(event.pointerId); drawAt(event); });
  document.addEventListener('pointermove', (event) => { if (drawing && event.buttons) drawAt(event); });
  document.addEventListener('pointerup', () => { drawing = null; });
  document.addEventListener('pointercancel', () => { drawing = null; });
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form.matches('[data-scout-import-form]') && !parseImport(form)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (form.matches('[data-scout-event-delete]') && form.elements.confirm_event_name.value !== eventName()) { event.preventDefault(); event.stopImmediatePropagation(); form.elements.confirm_event_name.setCustomValidity('Enter the selected event name exactly.'); form.elements.confirm_event_name.reportValidity(); return; }
    if (form.matches('[data-scout-autoassign]')) { const selected = [...form.querySelectorAll('input[name="pool"]:checked')].map((i) => i.value); const empty = document.querySelector('select[name="blue3"]'); const assigned = [...document.querySelectorAll('select[name^="red"],select[name^="blue"]')].map((s) => s.value).filter(Boolean); const available = selected.find((s) => !assigned.includes(s)); if (empty && !empty.value && available) empty.value = available; }
    if (form.matches('[data-scout-match-form]')) show(form, `Sample ${state.editing ? 'update' : 'submission'} complete: ${form.elements.match_type.selectedOptions[0].textContent} ${form.elements.match_number.value} · Team ${form.elements.team_number.value} · Alex Chen. No live record changed. You can return to Scouting for the next assignment.`);
    if (form.matches('[data-scout-pit-form]')) show(form, `Sample pit report updated: Team ${form.elements.team_number.value} · Alex Chen. Other scouts’ reports remain separate. No live record changed.`);
    if (form.matches('[data-scout-delete-form]')) { const row = form.closest('[data-scout-history]'); const msg = document.createElement('p'); msg.className = 'notice info'; msg.setAttribute('role', 'status'); msg.textContent = 'This sample match report was removed from the view. No live record changed.'; row.replaceWith(msg); }
  }, true);
  document.addEventListener('input', (event) => { if (event.target.name === 'confirm_event_name') event.target.setCustomValidity(''); });
})();
