import requests

url = 'http://localhost:5000/api/complaints'
json_data = {
    'prompt': 'There is a huge pothole on the main road',
    'location': 'Main Road, City Center',
    'latitude': '40.7128',
    'longitude': '-74.0060'
}
response = requests.post(url, json=json_data)
print(response.status_code)
print(response.json())
