import http.client

conn = http.client.HTTPSConnection("twitter-x.p.rapidapi.com")

headers = {
    'x-rapidapi-key': "4f47831a90mshe626bdd9598a85ap1086f8jsne61226e4e40d",
    'x-rapidapi-host': "twitter-x.p.rapidapi.com"
}

conn.request("GET", "/user/tweetsandreplies?user_id=44196397&limit=20", headers=headers)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))