// howler-mini.js. (c) 2014, Michael Romanovsky (Flyingsoft games). Licensed under the MIT license.

void function () {
 "use strict"
 
 // Set up an audio context.
 var ctx = (typeof AudioContext != "undefined") ? new AudioContext () : new webkitAudioContext ()
 
 var Howl = function (options) {var howl = this; howl.init (options)}
 
 // Initialize a new Howl group object.
 Howl.prototype.init = function (options) {
  var howl = this
  
  // Create a gain node.
  var gain = howl.gain = (typeof ctx.createGain == "undefined") ? ctx.createGainNode () : ctx.createGain ()
  gain.gain.value = (typeof options.volume != "undefined") ? options.volume : 1; gain.connect (ctx.destination)
  
  // Define getters/setters for .loaded, .volume, .duration, and .position.
  Object.defineProperty (howl, "loaded", {get: function () {return (!!howl.buffer == true)}})
  Object.defineProperty (howl, "volume"  , {get: function () {return gain.gain.value}, set: function (new_volume) {gain.gain.value = new_volume}})
  Object.defineProperty (howl, "position", {
   get: function () {return (typeof howl.started_date == "undefined") ? 0 : (+new Date () / 1000 - howl.started_date + howl.paused_position)},
   set: function (new_position) {
    if (!howl.buffer) return
    howl.started_position = +new Date () / 1000 - new_position
    howl.paused_position = new_position
    var is_paused = howl.paused
   }
  })
  Object.defineProperty (howl, "duration", {get: function () {if (!howl.buffer) return 0; return howl.buffer.duration}})
  
  // Set up user-defined default properties.
  howl.bufferfile  = options.bufferfile
  howl.buffersize  = options.buffersize
  howl.src         = (typeof options.src != "string") ? options.src : options.src
  howl.autoplay    = options.autoplay || false
  howl.paused      = true
  howl.ended       = false
  howl.paused_position = 0
  howl.first_buffer_loaded = false
  
  // Setup event listeners.
  howl.onend       = options.onend
  howl.onfaded     = options.onfaded
  howl.onload      = options.onload
  howl.onloaderror = options.onloaderror
  howl.onpause     = options.onpause
  howl.onplay      = options.onplay
  
  // Load and decode the audio data for playback.
  load_buffers (howl)
  return howl
 }
 
 // Play a sound or resume previous playback.
 Howl.prototype.play = function (init) {
  if (typeof init == "undefined") init = {}
  if (typeof init == "number") {init.position = init; init = {}}
  if (typeof init.position != "undefined") howl.paused_position = init.position 
  var howl = this
  if (typeof howl.buffer == "undefined") return howl
  if (!howl.paused) howl.pause ({do_not_emit_pause_event: true})
  howl.source = ctx.createBufferSource ()
  howl.source.buffer = howl.buffer
  howl.source.connect (ctx.destination)
  howl.source.connect (howl.gain)
  howl.paused = false
  howl.ended  = false
  howl.source.start (0, howl.paused_position)
  howl.started_date = +new Date () / 1000
  if (!init.do_not_set_end_event) {
   howl.buffer.onended = function () {
    howl.ended = true
    howl.source.onended = function () {}
    howl.paused = true
    howl.emit ("end")
   }
  }
  howl.source.onended = howl.buffer.onended
  if (!init.do_not_emit_play_event) setTimeout (function () {howl.emit ("play")}, 0)
  return howl
 }
 
 Howl.prototype.pause = function (init) {
  var init = init || {}
  var howl = this
  // If "do_not_stop_autoplay" (set to "true" for loading) is false, .autoplay is "true" and .loaded is "false", set .autoplay to "false".
  if ((!init.do_not_stop_autoplay) && (howl.autoplay == true) && (howl.loaded == false)) howl.autoplay = false
  // Clear the onended event and stop the audio from playing.
  if (howl.source) {howl.source.onended = howl.buffer.onended = function () {}; howl.source.stop ()}
  
  // If the sound was already paused, don't change the pause position.
  if (!howl.paused) {
   var current_date = +new Date () / 1000
   if (typeof howl.started_date == "undefined") howl.started_date = current_date
   howl.paused_position += current_date - howl.started_date
  }
  howl.paused = true
  
  if (!init.do_not_emit_pause_event) howl.emit ("pause")
  return howl
 }
 
 Howl.prototype.emit = function (event_name) {if (typeof this["on" + event_name] == "function") this["on" + event_name] (); return this}
 
 function load_buffers (howl) {
  if ((typeof howl.buffersize != "undefined") || (typeof howl.bufferfile != "undefined")) {
   // Load the buffer from the URL.
   var shortxhr = new XMLHttpRequest ()
   shortxhr.open ('GET', (typeof howl.bufferfile != "undefined") ? howl.bufferfile : howl.src, true)
   if (typeof howl.buffersize != "undefined") {
    shortxhr.setRequestHeader ('Range', 'bytes=0-' + (howl.buffersize - 1))
    shortxhr.setRequestHeader ('Content-Length', howl.buffersize)
   }
   shortxhr.responseType = 'arraybuffer'
   shortxhr.onreadystatechange = function () {
   if (shortxhr.readyState != 4) return
   decodeAudioData (shortxhr.response, howl, false)}
   shortxhr.onerror = function () {}
   shortxhr.send ()
  }
  var xhr = new XMLHttpRequest ()
  xhr.open ('GET', howl.src, true)
  xhr.responseType = 'arraybuffer'
  xhr.onload = function () {decodeAudioData (xhr.response, howl, true)}
  xhr.send ()
 }
 
 function load_sound (howl, buffer) {
  // Did a previous buffer exist?
  var previous_buffer_exists = (typeof howl.buffer != "undefined")
  
  // Stop any previously loaded buffer and cache the sound position for any upcoming "play" function.
  if (previous_buffer_exists) howl.pause ({do_not_stop_autoplay: true, do_not_emit_pause_event: true})
  
  // Create a new source, add the buffer to it, and push both source and buffer to the source list and buffer list.
  howl.buffer = buffer
  
  // Emit the load event if it hasn't been emitted yet.
  if (!previous_buffer_exists) setTimeout (function () {howl.emit ("load")}, 0)
 }
 
 function decodeAudioData (arraybuffer, howl, is_main_buffer) {
  ctx.decodeAudioData (arraybuffer, function (buffer) {
   var previous_buffer_exists = (typeof howl.buffer != "undefined")
   load_sound (howl, buffer)
   // If the buffer was loaded before, do not emit the play event.
   // If the buffer is not the main buffer, do not emit the end event when the audio finishes.
   if (howl.autoplay) howl.play ({do_not_emit_play_event: previous_buffer_exists, do_not_set_end_event: !is_main_buffer})
  }, function () {howl.emit("loaderror")})
 }
 
 window.Howl = Howl
} ()
