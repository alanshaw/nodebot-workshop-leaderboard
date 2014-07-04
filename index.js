var http = require("http")
  , fs = require("fs")
  , dgram = require("dgram")

var state = {} // {workshop: {IP: {name: "username", exercises: [passed exercises]}}}

var server = http.createServer(function (req, res) {
  res.writeHead(200, {"Content-Type": "text/html"})
  fs.createReadStream(__dirname + "/index.html").pipe(res)
})

var port = process.env.PORT || 8080
var broadcastPort = process.env.PROGRESS_BROADCAST_PORT || 1138

server.listen(port, function () {
  console.log("Leaderboard listening on *:" + port)
})

var io = require("socket.io")(server)

io.on("connection", function (socket) {
  socket.emit("state", state)

  socket.on("name", function (name, ip) {
    Object.keys(state).forEach(function (workshop) {
      Object.keys(state[workshop]).forEach(function (workshopIp) {
        if (ip == workshopIp) {
          state[workshop][ip].name = name
        }
      })
    })
    io.emit("state", state)
  })
})

var sock = dgram.createSocket("udp4")

sock.bind(broadcastPort, function () {
  sock.setBroadcast(true)
  console.log("Leaderboard pass broadcast listening on *:" + broadcastPort)
})

sock.on("message", function (data, rinfo) {
  console.log("Got message", data.toString(), rinfo)

  try {
    data = JSON.parse(data.toString())
  } catch (er) {
    return console.log("Ignoring non-JSON message", data)
  }

  if (!data.workshop) return console.log("Ignoring non-workshop message", data)
  if (data.event != "pass") return console.log("Ignoring non-pass message", data)

  state[data.workshop] = state[data.workshop] || {}
  state[data.workshop][rinfo.address] = state[data.workshop][rinfo.address] || {}
  state[data.workshop][rinfo.address].exercises = state[data.workshop][rinfo.address].exercises || []

  var passedExercises = state[data.workshop][rinfo.address].exercises

  if (passedExercises.map(function (e) { return e.name }).indexOf(data.exercise) > -1) {
    return console.log("Ignoring message", rinfo.address, "already passed", data.exercise)
  }
  
  console.log(rinfo.address, "just completed", data.exercise)

  passedExercises.push({name: data.exercise, timestamp: data.timestamp})

  io.emit("state", state)
})