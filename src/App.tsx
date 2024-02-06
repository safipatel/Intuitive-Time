import React, {
  memo,
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
  where,
} from "firebase/firestore";
import { useCollectionData } from "react-firebase-hooks/firestore";
import moment, { Moment } from "moment";
import { Gauge } from "@ant-design/plots";
import { Datum, GaugeConfig, Plot } from "@ant-design/charts";
import { FaAngleDoubleRight } from "react-icons/fa";
import { BsSunFill, BsMoonFill, BsGoogle } from "react-icons/bs";
import { GoogleAuthProvider, getAuth, getRedirectResult, onAuthStateChanged, setPersistence, signInWithRedirect, browserLocalPersistence } from "firebase/auth";


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
const auth = getAuth();
setPersistence(auth,browserLocalPersistence);

const provider = new GoogleAuthProvider();

type ReturnStruct = {
  start: Timestamp;
  created: Timestamp;
  uid: string;
};

const postConverter: FirestoreDataConverter<ReturnStruct> = {
  toFirestore(post: WithFieldValue<ReturnStruct>): DocumentData {
    return { start: post.start, created: post.created, uid: post.uid };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): ReturnStruct {
    const data = snapshot.data(options);
    return {
      start: data.start,
      created: data.created,
      uid: data.uid,
    };
  },
};

function App() {
  const [loggedInUserID, setLoggedInUserID] = useState<string | undefined>(undefined);
  const [loadingLoginState, setLoadingLoginState] = useState<boolean>(true);
  console.log(loggedInUserID);

  getRedirectResult(auth)
    .then((result) => {
      if(!result){return;}
      setLoggedInUserID (result.user.uid);
      setLoadingLoginState(false);
    }).catch((error) => {
       // Handle Errors here.
       const errorCode = error.code;
       setLoggedInUserID(undefined);
       if (errorCode === 'auth/account-exists-with-different-credential') {
         alert(
           'You have already signed up with a different auth provider for that email.',
         );
         // If you are using multiple auth providers on your app you should handle linking
         // the user's accounts here.
       } else {
         console.error(error);
       }
    });
  
    onAuthStateChanged(auth, function (user) {
      setLoggedInUserID(user?.uid);
      setLoadingLoginState(false);
      // if (user) {
      //   setLoggedInUserID(user.uid);
      // } else {
      //   setLoggedInUserID(undefined);
      // }
    });

    if(loadingLoginState){
      return (<div className="App"></div>);
    }

  return (
    <div className="App">
      
      {
        loggedInUserID!==undefined ?
      (<div className="container">
        <DisplayStats />
        <AddButton/>
      </div>) 
      : (<div className={"button-container"}><button className={"sign-in-button"} onClick={(e) => signInWithRedirect(auth, provider)}>Sign in with Google <BsGoogle /></button></div>)
        }

    </div>
  );
}

function AddButton() {
  const [inputStartTime, setInputStartTime] = useState<string | undefined>(
    moment().format("YYYY-MM-DDTHH:mm")
  );
    const currentUser = auth.currentUser?.uid;
  function addTime() {
    console.log(currentUser);

    if (!inputStartTime || new Date(inputStartTime).getTime() > Date.now() || !currentUser) {
      return;
    }
    const newTimeRef = doc(collection(db, "times"));

    setDoc(newTimeRef, { start: Timestamp.fromDate(new Date(inputStartTime)),created: Timestamp.fromDate(new Date()), uid: currentUser });
  }

  return (
    <div className="button-container">
      <label>
        Start time:
        <input
          type="datetime-local"
          name="startTime"
          value={inputStartTime}
          onChange={(e) => setInputStartTime(e.target.value)}
        />
      </label>

      <button onClick={addTime}>Set today's start</button>
    </div>
  );
}

function DisplayStats() {
  // Load-in data from firebase
  // if(!auth.currentUser){return;}
  const q = useMemo(() => {
    const timesRef = collection(db, "times").withConverter(postConverter);
    return query(timesRef, where("uid", "==", auth.currentUser?.uid ), orderBy("created", "desc"), limit(1));
  }, []);

  const [loadedStartTimeContainer, status] = useCollectionData(q);

  // States that update every second or if startTime changes
  const [startTime, setStartTime] = useState<Moment>(moment());

  // Ref that refers to the gauge
  const gaugeRef = useRef<Plot<any> | null>(null);

  // Callback function that updates everytime the data changes
  const updateStats = useCallback(() => {
    if (!loadedStartTimeContainer?.[0]?.start) {
      return;
    }
    const st = moment(loadedStartTimeContainer?.[0].start.toDate());
    setStartTime(st);

    if (gaugeRef.current) {
      const percSpent =
        moment.duration(moment().diff(st)).asSeconds() / (16 * 60 * 60);
      gaugeRef.current.changeData(percSpent);
    }
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

  return <DisplayWriting startTime={startTime.valueOf()} gaugeRef={gaugeRef} />;
}

const GaugeMemo = memo(function GaugeMemo({
  startTime,
  gaugeRef,
}: {
  startTime: number;
  gaugeRef: any;
}) {
  const tickFormatter = useCallback(
    (v: string) => {
      return (
        (Number(v) * 100).toFixed(0) +
        "%\n" +
        moment(startTime)
          .add(Number(v) * 16, "hours")
          .format("hh:mmA")
      );
    },
    [startTime]
  );
    console.log("hi");
  const statFormatter = useCallback((percent: Datum | undefined) => {
    return percent
      ? `Day Spent: ${(percent["percent"] * 100).toFixed(3)}%`
      : "0";
  }, []);
  // window.visualViewport?.width
  const config: GaugeConfig = useMemo(
    (): GaugeConfig => ({
      percent:
        moment.duration(moment().diff(moment(startTime))).asSeconds() /
        (16 * 60 * 60),
      // width: window.innerWidth / 40,
      height:
        window.innerWidth > 600
          ? window.innerHeight / 1.25
          : window.innerHeight / 1.9,
      range: {
        color: "#30BF78",
      },
      renderer: "svg",
      // innerRadius: 0.7,
      indicator: {
        pointer: {
          style: {
            lineWidth: 5,
            stroke: "#D0D0D0",
          },
        },
        pin: {
          style: {
            stroke: "#D0D0D0",
          },
        },
      },
      axis: {
        nice: true,
        label: {
          style: {
            fill: "black",
            textBaseline: "middle",
            fontSize: window.innerWidth > 600 ? window.innerWidth * 0.009 : 10,
            fontFamily: "'Fira Sans', sans-serif",
          },
          offset: window.innerWidth > 600 ? window.innerWidth * -0.035 : -30,
          formatter: tickFormatter,
        },
        tickLine: {
          length: window.innerWidth > 600 ? window.innerWidth * -0.01 : -20,
          alignTick: true,
        },
        tickInterval: window.innerWidth < 600 ? 0.2 : 0.05,
        subTickLine: {
          count: 1,
        },
        tickMethod: "time",
      },
      statistic: {
        title: {
          formatter: statFormatter,
          style: {
            color: "black",
            fontSize: "1rem;",
          },
        },
      },
      onReady: (plot: any) => {
        gaugeRef.current = plot;
      },
    }),
    [gaugeRef, startTime, statFormatter, tickFormatter]
  ); // Percentage-spent intentionally left out since we don't want it to rerender this gauge component everytime. We're just passing it in since we want the gauge to have the correct initial value before the ref loads in an sets the correct value
  return <Gauge {...config} />;
});

function DisplayWriting({
  startTime,
  gaugeRef,
}: {
  startTime: number;
  gaugeRef: any;
}) {
  const startTimeMoment = moment(startTime);
  const timeSpentDuration = moment.duration(moment().diff(startTime));
  const fifteenMinBlockSpent = timeSpentDuration.asMinutes() / 15;
  const tenMinBlockSpent = timeSpentDuration.asMinutes() / 10;

  const timeLeftDuration = moment.duration(
    startTimeMoment.clone().add(16, "hours").diff(moment())
  );
  const fifteenMinBlockLeft = timeLeftDuration.asMinutes() / 15;
  const tenMinBlockLeft = timeLeftDuration.asMinutes() / 10;

  const percentageSpent =
    (timeSpentDuration.asSeconds() / (16 * 60 * 60)) * 100;

  // const percentageLeft = timeLeftDuration.asSeconds() / (16 * 60 * 60) * 100;
  const percentageLeft = 100 - percentageSpent;

  const startTimeFormatArr = startTimeMoment
    .format("hh:mm A, MMM DD")
    .split(", ");
  const endTimeFormatArr = startTimeMoment
    .clone()
    .add(16, "hours")
    .format("hh:mm A, MMM DD")
    .split(", ");

  return (
    <>
      <div className="clock">
        <div className="clock-text">

        {new Date().toLocaleTimeString()}
        </div>
      </div>
      <div className="display-container">
        <div className="statistics-container">
          <div className="start-end-time">
            <div className="time-header">
              <h3>Day Timing</h3>
              <hr />
            </div>
            <div className="time-container">
              <div className="sun-box">
                <div>
                <BsSunFill /><br />
                  <b>{startTimeFormatArr[0]}</b><br /> {startTimeFormatArr[1]}
                  
                </div>
              </div>
              <FaAngleDoubleRight  />

              <div className="moon-box">
                <div>
                <BsMoonFill /> <br />
                <b>{endTimeFormatArr[0]}</b> <br />
                {endTimeFormatArr[1]}
               </div>
              </div>
            </div>
          </div>
          <div
            className="spent-item"
            style={{
              background: `linear-gradient(to bottom, rgba(208, 208, 212, 0.231) ${percentageLeft}%, rgba(226, 65, 65, 0.454) 0%)`,
            }}
          >
            <h3>Spent</h3>
            <hr />
            <div>
              {timeSpentDuration.format("h [hrs], m [min], s [secs]", {
                trim: false,
              })}
              <br />
              {timeSpentDuration.format("m [minutes]", { trim: false })}
              <br />
              {`${fifteenMinBlockSpent.toFixed(1)} blocks of 15-min`}
              <br />
              {`${tenMinBlockSpent.toFixed(1)} blocks of 10-min`}
              <br />
              {percentageSpent.toFixed(3) + "%"}
              <br />
            </div>
          </div>
          <div
            className="left-item"
            style={{
              background: `linear-gradient(to bottom, rgba(208, 208, 212, 0.231) ${percentageSpent}%, rgba(31, 135, 41, 0.454) 0%)`,
            }}
          >
            <h3>Left</h3>
            <hr />
            <div>
              {timeLeftDuration.format("h [hrs], m [min], s [secs]", {
                trim: false,
              })}
              <br />
              {timeLeftDuration.format("m [minutes]", { trim: false })}
              <br />
              {`${fifteenMinBlockLeft.toFixed(1)} blocks of 15-min`}
              <br />
              {`${tenMinBlockLeft.toFixed(1)} blocks of 10-min`}
              <br />
              {percentageLeft.toFixed(3) + "%"}
            </div>
          </div>
        </div>
        <div className="gauge-container">
          <GaugeMemo gaugeRef={gaugeRef} startTime={startTime} />
        </div>
        <div className="conversions-container">
          <div className="conversion-list">
            <h3>Conversions</h3>
            <hr />
            <div>
              {"Based on 16-hour waking day:"}
              <br />
              {`1 hr = ${(1 / 16) * 100}%`}
              <br />
              {`15 mins = ${(15 / (16 * 60)) * 100}%`}
              <br />
              {`10 mins = ${((10 / (16 * 60)) * 100).toFixed(4)}%`} <br />
              {`1 min = ${((1 / (16 * 60)) * 100).toFixed(4)}%`} <br />
              {`1 sec = ${((1 / (16 * 60 * 60)) * 100).toFixed(4)}%`} <br />
            </div>
            <hr />
            <div>
              {`25% = 4 hrs`}
              <br />
              {`10% = 1 hrs, 36 mins`}
              <br />
              {`5% = 48 mins`}
              <br />
              {`1% = 9 mins, 36 seconds`} <br />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export default App;
