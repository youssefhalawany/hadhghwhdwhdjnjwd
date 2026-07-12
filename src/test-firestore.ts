import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

// Need user's firebase config. I can just check the browser or replace the query directly.
