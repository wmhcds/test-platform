import json

data = {
    "name": "python",
    "age": 18,
    "is_test": True,
    "skills": ["ui", "api"]
}

s = json.dumps(data)
# print(s)
# print(type(s))

a = data.values()
print(data.values())
print(type(a))