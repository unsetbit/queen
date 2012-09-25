(function (exports) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exports; // CommonJS
  } else if (typeof define === "function") {
    define(exports); // AMD
  } else {
    MinionMaster = exports; // <script>
  }
}((function () {
	var exports,
		WEB_SOCKET_SWF_LOCATION = "/minion-master/WebSocketMain.swf";
