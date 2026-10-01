from bs4 import BeautifulSoup

def inject_id_by_text(soup, tag, text, new_id):
    for el in soup.find_all(tag):
        if text.lower() in el.get_text().lower():
            el['id'] = new_id
            return True
    return False

# Load original
with open('c:/Users/cheta/Desktop/civicflow/frontend/index.html', 'r', encoding='utf-8') as f:
    orig = BeautifulSoup(f.read(), 'html.parser')

# Load screens
with open('c:/Users/cheta/Desktop/civicflow/stitch_assets/screen1.html', 'r', encoding='utf-8') as f:
    s1 = BeautifulSoup(f.read(), 'html.parser')
with open('c:/Users/cheta/Desktop/civicflow/stitch_assets/screen2.html', 'r', encoding='utf-8') as f:
    s2 = BeautifulSoup(f.read(), 'html.parser')
with open('c:/Users/cheta/Desktop/civicflow/stitch_assets/screen3.html', 'r', encoding='utf-8') as f:
    s3 = BeautifulSoup(f.read(), 'html.parser')

# Create new layout based on s1
new_doc = BeautifulSoup('<!DOCTYPE html><html lang="en"></html>', 'html.parser')
new_doc.html.append(s1.head)
new_doc.html.append(s1.body)

# Prepare containers
body = new_doc.body
body.clear()

# Add hidden inputs for location to avoid breaking app.js
hidden_inputs = BeautifulSoup('<input type="hidden" id="latitude"><input type="hidden" id="longitude"><input type="hidden" id="location"><input type="file" id="image" class="hidden">', 'html.parser')
body.append(hidden_inputs)

# citizenPortal (Screen 1)
citizen_portal = new_doc.new_tag('div', id='citizenPortal')
if s1.header: citizen_portal.append(s1.header)
if s1.main: citizen_portal.append(s1.main)

# Map s1 IDs
nav = citizen_portal.find('nav')
if nav:
    for a in nav.find_all('a'):
        if a.get('data-path') == 'report-issue': a['id'] = 'tabNewReport'
        if a.get('data-path') == 'my-reports': a['id'] = 'tabMyReports'
        if a.get('data-path') == 'civic-heroes': a['id'] = 'tabLeaderboard'

# Form section
textarea = citizen_portal.find('textarea')
if textarea:
    textarea['id'] = 'promptInput'
    form_section = textarea.find_parent('div', class_=lambda x: x and 'max-w-[1440px]' in x)
    if form_section:
        form_section['id'] = 'reportFormSection'
    # Also add statusMessage placeholder
    textarea.insert_after(new_doc.new_tag('div', id='statusMessage', **{'class': 'hidden mt-2 p-2 rounded'}))

# GeoBtn and Status
geo_btn = citizen_portal.find('span', string=lambda t: t and 'Calibrate Pin' in t)
if geo_btn:
    geo_btn_parent = geo_btn.parent
    geo_btn_parent['id'] = 'geoBtn'
    geo_btn_parent.insert_after(new_doc.new_tag('p', id='geoStatus', **{'class': 'text-sm mt-1'}))

# Voice Btn
voice_icon = citizen_portal.find('span', string=lambda t: t and 'mic' in t)
if voice_icon:
    voice_parent = voice_icon.parent
    voice_parent['id'] = 'voiceBtn'
    voice_parent.insert_after(new_doc.new_tag('p', id='voiceStatus', **{'class': 'text-sm mt-1'}))


# Leaderboard
lb_title = citizen_portal.find(string=lambda t: t and 'Civic Heroes Leaderboard' in t)
if lb_title:
    lb_section = lb_title.find_parent('div', class_=lambda x: x and 'max-w-[1440px]' in x)
    if lb_section: lb_section['id'] = 'leaderboardSection'
lb_list = citizen_portal.find('div', class_='flex flex-col gap-2')
if lb_list: lb_list['id'] = 'leaderboardList'
podium = citizen_portal.find('div', class_='grid grid-cols-3 gap-space-sm')
if podium: podium['id'] = 'podiumContainer'


# adminPortal (Screen 2)
admin_portal = new_doc.new_tag('div', id='adminPortal', **{'style': 'display: none;'})
if s2.header: admin_portal.append(s2.header)
if s2.main: admin_portal.append(s2.main)

# Map s2 IDs
map_div = admin_portal.find('div', class_=lambda c: c and 'bg-[#eef0ff]' in c)
if map_div: map_div['id'] = 'map'
if not map_div:
    map_divs = admin_portal.find_all('div', class_=lambda c: c and 'relative' in c and 'overflow-hidden' in c)
    for m in map_divs:
        if m.find('div', class_=lambda c: c and 'bg-blue-200' in c):
            m['id'] = 'map'
            break

admin_queue = admin_portal.find('div', class_='flex flex-col gap-space-xs')
if admin_queue: admin_queue['id'] = 'adminComplaintsList'

inject_id_by_text(admin_portal, 'span', '24,192', 'statTotal')
inject_id_by_text(admin_portal, 'span', '1,842', 'statPending')
inject_id_by_text(admin_portal, 'span', '412', 'statInProgress')
inject_id_by_text(admin_portal, 'span', '42', 'statHigh')

# myReportsSection (Screen 3)
my_reports = new_doc.new_tag('section', id='myReportsSection', **{'style': 'display: none;'})
if s3.main: my_reports.append(s3.main)
my_list = my_reports.find('div', class_='flex flex-col gap-space-md')
if my_list: my_list['id'] = 'myComplaintsList'


# Append everything to body
body.append(citizen_portal)
body.append(admin_portal)
body.append(my_reports)
if s1.footer: body.append(s1.footer)

# Auth Modal (from orig)
auth_modal = orig.find(id='authModal')
if auth_modal: body.append(auth_modal)

# Scripts (from orig)
for script in orig.find_all('script', src=True):
    if 'leaflet' in script['src'] or 'app.js' in script['src']:
        body.append(script)

with open('c:/Users/cheta/Desktop/civicflow/frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(str(new_doc))
