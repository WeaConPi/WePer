"use strict";

var app = require("../server");

module.exports = function(Hour) {
  Hour.measurement = function(buildingId, sensorData, cb) {
    const today = new Date().toDateString();
    app.models.Day.findOne(
      {
        where: {
          buildingId: buildingId,
          date: today
        }
      },
      (err, data) => {
        if (err) {
          cb("Error finding day for building");
          return;
        }
        if (data) {
          console.log("Found day, inserting hour" + today);
          upsertNewHour(data.id, sensorData, cb);
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
                upsertNewHour(data.id, sensorData, cb);
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
function upsertNewHour(dayId, sensorData, cb) {
  const currentHour = new Date().getHours();
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
      if (data) {
        console.log("Push sensor successfull");
        cb(null, "Sensor pushed successfully");
      } else {
        console.log("Error pushing sensor data to hour");
        cb("Error pushing sensor data to hour");
      }
    }
  );
}
