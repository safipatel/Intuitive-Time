import React, {
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./App.css";

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  Timestamp,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
  DocumentData,
  doc,
  setDoc,
} from "firebase/firestore";
import { useCollectionData } from "react-firebase-hooks/firestore";
import moment, { Duration, Moment } from "moment";
import { Gauge, Line } from '@ant-design/plots';
import { Datum, GaugeConfig, Options, Plot } from "@ant-design/charts";
require("moment-duration-format");

const firebaseApp = initializeApp({
  apiKey: "AIzaSyDrI_8JDEhHPSU9l3h_P251mrd_JoClTs4",
  authDomain: "intuitivetime-a76d2.firebaseapp.com",
  projectId: "intuitivetime-a76d2",
  storageBucket: "intuitivetime-a76d2.appspot.com",
  messagingSenderId: "438443460337",
  appId: "1:438443460337:web:5b12f51e3b9df687ba0b50",
});

const db = getFirestore(firebaseApp);

type ReturnStruct = {
  start: Timestamp;
};

const postConverter: FirestoreDataConverter<ReturnStruct> = {
  toFirestore(post: WithFieldValue<ReturnStruct>): DocumentData {
    return { start: post.start };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): ReturnStruct {
    const data = snapshot.data(options);
    return {
      start: data.start,
    };
  },
};

function App() {
  return (
    <div className="App">
      <header></header>

      <section>
        <DisplayStats />
        <AddButton />
      </section>
    </div>
  );
}

function AddButton() {
  const [inputStartTime, setInputStartTime] = useState<string | undefined>(
    moment().format("YYYY-MM-DDTHH:mm")
  );

  function addTime() {
    if (!inputStartTime || new Date(inputStartTime).getTime() > Date.now()) {
      return;
    }
    const newTimeRef = doc(collection(db, "times"));

    setDoc(newTimeRef, { start: Timestamp.fromDate(new Date(inputStartTime)) });
  }

  return (
    <>
      <label>
        Start time:
        <input
          type="datetime-local"
          name="startTime"
          value={inputStartTime}
          onChange={(e) => setInputStartTime(e.target.value)}
        />
      </label>

      <button onClick={addTime}>Set current start</button>
    </>
  );
}

function DisplayStats() {
  // Load-in data from firebase
  const q = useMemo(() => {
    const timesRef = collection(db, "times").withConverter(postConverter);
    return query(timesRef, orderBy("start", "desc"), limit(1));
  }, []);
  const [loadedStartTimeContainer, status] = useCollectionData(q);

  // console.log(loadedStartTimeContainer?.[0].start);
  // console.log(status);
  // const startTime = moment(loadedStartTimeContainer?.[0].start.toDate());

  // States that update every second or if startTime changes
  const [startTime, setStartTime] = useState<Moment>(moment());

  // Callback function that updates everytime the data changes
  const updateStats = useCallback(() => {
    if (!loadedStartTimeContainer?.[0]?.start) {
      return;
    }
    setStartTime(moment(loadedStartTimeContainer?.[0].start.toDate()));
    // setTimeSpentDuration(
    //   moment.duration(moment().diff(loadedStartTimeContainer[0].start.toDate()))
    // );
  }, [loadedStartTimeContainer]);

  // Resets the interval every second if the data changes which would have changed updateStats()
  const intervalRef = useRef<NodeJS.Timer>();
  useEffect(() => {
    // console.log("hello");
    updateStats(); // Need this here in order to update the numbers right away and not wait a second when page first loads
    const id = setInterval(updateStats, 1000);
    intervalRef.current = id;
    return () => clearInterval(intervalRef.current);
  }, [updateStats]);

  if (status || !startTime) {
    return <></>;
  }

  return <DisplayWriting startTime={startTime}/>;
}

function DisplayWriting({ startTime}: { startTime: Moment}) {
  const timeSpentDuration = moment.duration(moment().diff(startTime));
  const timeLeftDuration = moment.duration(
    startTime.clone().add(16, "hours").diff(moment())
  );

  const percentageSpent = (timeSpentDuration.asSeconds() / (16 * 60 * 60) * 100);
  
  // const percentageLeft = timeLeftDuration.asSeconds() / (16 * 60 * 60) * 100;
  const percentageLeft = 100 - percentageSpent;
  
  const config: GaugeConfig = {
    percent: percentageSpent / 100,
    range: {
      color: '#30BF78',
    },
    // innerRadius: 0.7,
    indicator: {
      pointer: {
          style: {
            lineWidth: 5,
            stroke: '#D0D0D0',
          }
      },
      pin: {
        style: {
          stroke: '#D0D0D0',
        },
      },
    },
    axis: {
      min: 0,
      max: 1,
      label: {
        formatter(v:string) {
          return (Number(v)* 100).toFixed(0) + "%\n" + startTime.clone().add(Number(v) * 16, "hours").format("hh:mmA");
        },
      },
      tickInterval: 0.05,
      subTickLine: {
        count: 1,
      },
    },
    statistic: {
      content: {
        formatter: (percent: ( Datum | undefined)) => percent ? `Spent: ${(percent["percent"] * 100).toFixed(3)}%` : "0",   
          style: {
          color: 'rgba(0,0,0,0.65)',
          fontWeight: 42,
        },
      },
    },
  };

  return (
    <div className="displayStats"> 
      <Gauge {...config} />
      {(new Date()).toLocaleTimeString()}<br />
      {"Time spent: " +
        timeSpentDuration.format("h [hrs], m [min], s [secs]", { trim: false })}
      <br />
      {"Time spent in minutes: " +
        timeSpentDuration.format("m [minutes]", { trim: false })}
      <br />
      {"Percentage spent: " + percentageSpent.toFixed(3)+"%"}
      <br />
      {"Time left: " +
        timeLeftDuration.format("h [hrs], m [min], s [secs]", {
          trim: false,
        })}
      <br />
      {"Time left in minutes: " +
        timeLeftDuration.format("m [minutes]", { trim: false })}
      <br />
      {"Percentage left: " + percentageLeft.toFixed(3)+"%"}
      <br />
      {startTime.toISOString()} <br />
      {startTime.toLocaleString()}
    </div>
  );
}
export default App;
