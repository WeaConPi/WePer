"use strict";
var request = require("request")
var app = require("../server");
var host = process.env.weacore || "http://localhost:4000"
module.exports = function (Hour) {
  Hour.measurement = function (buildingId, sensorData, cb) {
    const today = new Date();
    today.setHours(today.getHours()+2)
    app.models.Day.findOne(
      {
        where: {
          buildingId: buildingId,
          date: today.toDateString()
        }
      },
      (err, data) => {
        if (err) {
          cb("Error finding day for building");
          return;
        }
        if (data) {
          console.log("Found day, inserting hour" + today);
          upsertNewHour(data.id,today.getHours(), sensorData, cb);
        } else {
          app.models.Day.create(
            {
              date: today,
              note: "",
              buildingId: buildingId
            },
            (err, data) => {
              if (data) {
                console.log("Created day, insertin hour" + today);
                upsertNewHour(data.id,today.getHours(), sensorData, cb);
              } else {
                cb("Error creating new day for building");
                return;
              }
            }
          );
        }
      }
    );
  };
  Hour.remoteMethod("measurement", {
    http: { path: "/measurement/:buildingId", verb: "post" },
    accepts: [
      { arg: "buildingId", type: "string", required: true },
      { arg: "sensorData", type: "sensor", http: { source: "body" } }
    ],
    returns: { arg: "status", type: "string" }
  });
};
function upsertNewHour(dayId,currentHour, sensorData, cb) {
  app.models.Hour.findOne(
    {
      where: {
        number: currentHour,
        dayId: dayId
      }
    },
    (err, data) => {
      if (err) {
        console.log("Error occured finding new hour" + currentHour);
      }
      if (data) {
        console.log("have hour,creating sensor" + currentHour);
        pushSensor(data, sensorData, cb);
      } else {
        console.log("No hour for day, creating new " + currentHour);
        createHour(dayId, currentHour, sensorData, cb);
      }
    }
  );
}

function createHour(dayId, currentHour, sensorData, cb) {
  app.models.Hour.create(
    {
      number: currentHour,
      dayId: dayId,
      sensors: []
    },
    (err, data) => {
      if (err) {
        console.log("Error creating hour occured" + currentHour);
        cb("Error creating hour");
      }
      if (data) {
        console.log("New hour created, inserting sensor" + currentHour);
        pushSensor(data, sensorData, cb);
      }
    }
  );
}

function pushSensor(currentHourObj, sensorData, cb) {
  currentHourObj.sensors.push(sensorData);
  app.models.Hour.replaceById(
    currentHourObj.id,
    currentHourObj,
    (err, data) => {
      if (data && sensorData.type === 'Temperature') {
        console.log("Push sensor successfull");
        console.log(data.id)
        request.get(host + "/measurement-hook?hourId=" + data.id,
          (error, res, body) => {
            console.log("Sensor insert hook trigger  hour id " + data.id)
            return;
          });
        cb(null, "Sensor pushed successfully");
      } else {
        console.log("Error pushing sensor data to hour");
        cb("Error pushing sensor data to hour");
      }
    }
  );
}
