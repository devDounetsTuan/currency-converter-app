const express = require("express");
const path = require("path");
const axios = require("axios");
const redis = require("redis");
const bluebird = require("bluebird");

const app = express();

const API_URL = "http://data.fixer.io/api/";
app.get("/", (req, res) => {
  res.sendFile("index.html", {
    root: path.join(__dirname, "views")
  });
});
/* app.get('/rate/:date', (req, res) => {
  const date = req.params.date;
  const url = `${API_URL}/${date}?access_key=3fab6638010deb72c155ab9c145185a8`;
  axios.get(url).then(response => {
    return res.json({ rates: response.data.rates });
  }).catch(error => {
    console.log(error);
  });
});
 */
// connect to Redis

const REDIS_URL = process.env.REDIS_URL;

const client = redis.createClient(REDIS_URL);
//console.log(REDIS_URL);
client.on("connect", () => {
  console.log(`connected to redis`);
});
client.on("error", err => {
  console.log(`Error: ${err}`);
});

app.get("/rate/:date", (req, res) => {
  const date = req.params.date;
  const url = `${API_URL}/${date}?access_key=3fab6638010deb72c155ab9c145185a8`;
  const countKey = `USD:${date}:count`;
  const ratesKey = `USD:${date}:rates`;
  let count;
  client
    .incrAsync(countKey)
    .then(result => {
      console.log('count'+ result);
      count = result;
      return count;
    })
    .then(() => client.hgetallAsync(ratesKey))
    .then(rates => {
      if (rates) {
        return res.json({ rates, count });
      }
      axios
        .get(url)
        .then(response => {
          client.hmsetAsync(ratesKey, response.data.rates).catch(e => {
            console.log(e);
          });
          return res.json({
            count,
            rates: response.data.rates
          });
        })
        .catch(error => res.json(error.response.data));
    })
    .catch(e => {
      console.log(e);
    });
});

// make node_redis promise compatible
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const port = process.env.port || 5000;
app.listen(port, () => {
  console.log(`App listening on port ${port}!`);
});
