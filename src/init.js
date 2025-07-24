// src/init.js
import mondaySdk from "monday-sdk-js";

const monday = mondaySdk();

export default monday;
window.global ||= window;
