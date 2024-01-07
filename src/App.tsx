import React, { useState } from 'react';
import './App.css';

import {initializeApp} from "firebase/app";
import {getFirestore, collection, query, orderBy, limit, Timestamp, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, WithFieldValue, DocumentData, doc, setDoc} from 'firebase/firestore';
import {useCollectionData} from 'react-firebase-hooks/firestore'
import moment from 'moment';


const firebaseApp = initializeApp({  
  apiKey: "AIzaSyDrI_8JDEhHPSU9l3h_P251mrd_JoClTs4",
  authDomain: "intuitivetime-a76d2.firebaseapp.com",
  projectId: "intuitivetime-a76d2",
  storageBucket: "intuitivetime-a76d2.appspot.com",
  messagingSenderId: "438443460337",
  appId: "1:438443460337:web:5b12f51e3b9df687ba0b50"
});

const db = getFirestore(firebaseApp);

type ReturnStruct = {
  start: Timestamp,
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
      <header>
      </header>

      <section>
        <DisplayStats />
      </section>
    </div>
  );
}



function DisplayStats(){
  const [startTime, setStartTime] = useState <string|undefined> (moment().format("YYYY-MM-DDTHH:mm")); 

  const timesRef = collection(db,'times').withConverter(postConverter);
  const q = query(timesRef, orderBy('start',"desc"), limit(1));

  const [loadedStartTime] = useCollectionData(q);

  // const querySnapshot = await getDocs(q);
  // querySnapshot.forEach((doc) => {
  // // doc.data() is never undefined for query doc snapshots
  // console.log(doc.id, " => ", doc.data());
  // });

  function addTime(){
    if (!startTime || new Date(startTime).getTime() > Date.now()){
      return;
    }
    const newTimeRef = doc(collection(db, "times"));
    
    setDoc(newTimeRef, {start: Timestamp.fromDate(new Date(startTime))});
  }

  return (
    <>
      <p>
        {loadedStartTime && loadedStartTime[0] && 
        <>
          {loadedStartTime[0].start.toDate().toISOString()} <br />
          {loadedStartTime[0].start.toDate().toLocaleString()}
        </>
      }
        </p>
      

      <label>
        Start time:
      <input type="datetime-local" name="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} />
      </label>
      
      {/* <Datetime value={startTime} onChange={e => setStartTime(e)} /> */}
      <button onClick={addTime}>Set current start</button>
      
    </>

  );/*  */
}

export default App;
