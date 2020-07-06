const now = Date.now()
const milliPerDay = 1000 * 24 * 60 * 60

var inData
var outData = []

function graphData(datas){
  console.log(datas)
  if(document.getElementById("useCutoffDate").checked){
    var cutOff = new Date(document.getElementById("cutoffDate").valueAsNumber)
    datas.messes = datas.messes.filter(o => o.time > cutOff)
  }
  const startDate = datas.messes.map(o => o.time).reduce((low,n) => Math.min(low,n))
  var dayCounts = []
  for(var ts = 0; startDate + milliPerDay * ts < now; ts ++){
    var countThisDay = datas.messes.filter(o => o.time > startDate + milliPerDay * ts && o.time <= startDate + milliPerDay * (ts + 1)).length
    dayCounts.push(countThisDay)
  }
  dayChart.chart.data.datasets[0].label = "Total number of messages sent each day"

  if(document.getElementById("doSmoothing").checked){
    const smoothSize = 7
    dayChart.chart.data.datasets[0].label = smoothSize + " day moving average of " + dayChart.chart.data.datasets[0].label
    var avgs = []
    for(var i = 0; i < dayCounts.length; i++){
      var sum = 0
      for(var j = i; j >= 0 && i - j < smoothSize; j--){
        sum += dayCounts[j]
      }
      avgs.push(sum/smoothSize)
    }
    dayCounts = avgs
  }
  var userCounts = datas.uniques.map(n => {return {uniqueName: n, count: 0}})
  datas.messes.forEach(o => {
    //userCounts[datas.uniques.findIndex(k => k == o.uniqueName)].count += o.len ? o.len : 1
    userCounts[datas.uniques.findIndex(k => k == o.uniqueName)].count += 1
  })
  const minMessageCount = document.getElementById("minMessages").value
  userCounts = userCounts.filter(o => o.count >= minMessageCount)
  userCounts = userCounts.sort((a,b) => b.count - a.count)
  if(false){
    userCounts = userCounts.map(o => {return {name: "Someone", count: o.count}})
  }else{
    userCounts = userCounts.map(o => {
      o.name = datas.messes.find(k => k.uniqueName == o.uniqueName)?.name
      if(!o.name){
        o.name = o.uniqueName
      }
      return o
    })
  }

  userChart.chart.data.labels = userCounts.map(o => o.name)
  userChart.chart.data.datasets[0].data = userCounts.map(o => o.count)

  dayChart.chart.data.labels = dayCounts.map((o,i) => {
    let d = new Date(startDate + i * milliPerDay)
    return d.getFullYear() + "-" + (d.getUTCMonth() + 1) + "-" + d.getUTCDate()
  })
  dayChart.chart.data.datasets[0].data = dayCounts

  userChart.chart.update(0)
  dayChart.chart.update(0)
}

function analyzeGroupMe(groupMeData){
  outData = []
  sendIds = []
  var excludeGID = document.getElementById("excludeGID").value.split("\n")
  groupMeData.forEach((mess,i) =>{
    if(i % 100 == 0){
      document.getElementById("progress").innerHTML = i
    }
    if(excludeGID.some(c => c == mess["sender_id"])){ return }
    outData.push({name: mess["name"], uniqueName: mess["sender_id"], time: mess["created_at"] * 1000})
    if(!sendIds.includes(mess["sender_id"])){
      sendIds.push(mess["sender_id"])
    }
  })
  
  //var sendIds = outData.map(o => o.uniqueName).filter((value, index, self) => self.indexOf(value) === index)
  return {messes: outData, uniques: sendIds}
}

function analyzeDHT(inData){
  outData = []
  var excludeChans = document.getElementById("excludeChannels").value.split("\n")
  var excludeUsers = document.getElementById("excludeUsers").value.split("\n")
  for(let ch of Object.keys(inData.data)){
    let messes = inData.data[ch]
    for(let uid of Object.keys(messes)){
      var uniqueName = inData.meta.userindex[messes[uid].u]
      var name = inData.meta.users[uniqueName].name
      if(excludeUsers.some(c => c == name)){ continue }
      if(excludeChans.some(c => c == inData.meta.channels[ch].name)){ continue }

      outData.push({channel: inData.meta.channels[ch].name, name: name, uniqueName: uniqueName, time: messes[uid].t, len: messes[uid].m?.length})
    }
  }
  return {messes: outData, uniques: inData.meta.userindex}
}

var lastFileSize = 0
var lastParsed = {}
function analyze(){
  const getInData = cb => {
    var files = document.getElementById('selectFiles').files;
    //if(files[0].size == lastFileSize){ console.log("fast mode"); cb(lastParsed); return}
    //lastFileSize = files[0].size
    console.log(files);
    if (files.length <= 0) {
      return false;
    }
    var fr = new FileReader();
    fr.onload = function(e) { 
      lastParsed = JSON.parse(e.target.result)
      cb(lastParsed)
    }
    fr.readAsText(files.item(0));
  }
  var anal = document.getElementById("groupMeMode").checked ? analyzeGroupMe : analyzeDHT
  getInData(inData => graphData(anal(inData)))
}

window.onload = () => {
  const updatesAnalysis = domId => {
    document.getElementById(domId).addEventListener("change",() => analyze())
  }
  ["excludeUsers","excludeChannels","doSmoothing","useCutoffDate","cutoffDate","groupMeMode"].forEach(updatesAnalysis)
  var ctx = document.getElementById('userChart').getContext('2d');
  userChart = new Chart(ctx, {
      // The type of chart we want to create
      type: 'bar',

      // The data for our dataset
      data: {
          labels: [],
          datasets: [{
              label: 'Messages sent by this user',
              backgroundColor: 'rgb(255, 99, 132)',
              borderColor: 'rgb(255, 99, 132)',
              data: []
          }]
      },

      // Configuration options go here
    options: {
      scales: {
          xAxes: [{
              ticks: {
                  autoSkip: false,
                  maxRotation: 90,
                  minRotation: 90
              }
          }]
      }
  }
  });
  var dayctx = document.getElementById('dayChart').getContext('2d');
  dayChart = new Chart(dayctx, {
      // The type of chart we want to create
      type: 'line',

      // The data for our dataset
      data: {
          datasets: [{
              label: '',
            fill: false,
            lineTension: 0.1,
              backgroundColor: 'rgb(255, 99, 132)',
              borderColor: 'rgb(255, 99, 132)',
              data: []
          }]
      },

      // Configuration options go here
      options: {}
  });
  //analyze()
}
