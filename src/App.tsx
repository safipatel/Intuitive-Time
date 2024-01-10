import React, {
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
  const startTime = moment(loadedStartTimeContainer?.[0].start.toDate());

  // States that update every second or if startTime changes
  const [timeSpentDuration, setTimeSpentDuration] = useState<Duration>(
    moment.duration()
  );

  // Callback function that updates everytime the data changes 
  const updateStats = useCallback(() => {
    if (!loadedStartTimeContainer?.[0]?.start) {
      return;
    }
    setTimeSpentDuration(
      moment.duration(moment().diff(loadedStartTimeContainer[0].start.toDate()))
    );
  }, [loadedStartTimeContainer]);

  // Resets the interval every second if the data changes which would have changed updateStats()
  const intervalRef = useRef<NodeJS.Timer>();
  useEffect(() => {
    updateStats();    // Need this here in order to update the numbers right away and not wait a second when page first loads
    const id = setInterval(updateStats, 1000);
    intervalRef.current = id;
    return () => clearInterval(intervalRef.current);
  }, [updateStats]);

  if (status || !startTime) {
    return <></>;
  }

  return (
    <DisplayWriting
      startTime={startTime}
      timeSpentDuration={timeSpentDuration}
    />
  );
}

function DisplayWriting({
  startTime,
  timeSpentDuration,
}: {
  startTime: Moment;
  timeSpentDuration: Duration;
}) {
  return (
    <div className="displayStats">
      {"Time spent: " +
        timeSpentDuration.format("h [hrs], m [min], s [secs]", { trim: false })}
      <br />
      {"Time spent in minutes: " +
        timeSpentDuration.format("m [minutes]", { trim: false })}
      <br />
      {startTime.toISOString()} <br />
      {startTime.toLocaleString()}
    </div>
  );
}
export default App;
