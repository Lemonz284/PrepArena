import urllib.request
import json
import os
import urllib.error

api_key = 're_R61taFJL_GLxUcEN1nb3vEWaFhgpFN3Dy'
from_email = 'onboarding@resend.dev'
payload = json.dumps({
    'from': from_email,
    'to': ['ayyush.282004@gmail.com'],
    'subject': 'Test',
    'html': '<h1>Test</h1>'
}).encode('utf-8')
req = urllib.request.Request('https://api.resend.com/emails', data=payload, method='POST', headers={
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json',
    'User-Agent': 'PrepArena/1.0'
})
try:
    resp = urllib.request.urlopen(req)
    print(resp.status, resp.read())
except urllib.error.HTTPError as e:
    print(e.code, e.read())
