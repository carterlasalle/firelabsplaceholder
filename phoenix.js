(function () {
  'use strict';

  var managedTimers = new Set();
  var pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  function syncPointerCapability() {
    document.documentElement.toggleAttribute('data-can-hover', pointerQuery.matches);
  }

  function rafThrottle(callback) {
    var frame = 0;
    return function () {
      var context = this;
      var args = arguments;
      if (frame) return;
      frame = window.requestAnimationFrame(function () {
        frame = 0;
        callback.apply(context, args);
      });
    };
  }

  function managedInterval(callback, delay, options) {
    var settings = options || {};
    var intervalId = 0;
    var active = true;
    var manuallyPaused = false;

    function suspend() {
      if (!intervalId) return;
      window.clearInterval(intervalId);
      intervalId = 0;
    }

    function resume() {
      if (!active || manuallyPaused || document.hidden || intervalId) return;
      intervalId = window.setInterval(callback, delay);
    }

    function start() {
      manuallyPaused = false;
      resume();
    }

    function pause() {
      manuallyPaused = true;
      suspend();
    }

    function stop() {
      active = false;
      suspend();
      managedTimers.delete(controller);
    }

    var controller = {
      start: start,
      pause: pause,
      stop: stop,
      suspend: suspend,
      resume: resume
    };
    managedTimers.add(controller);
    if (settings.immediate) callback();
    start();
    return controller;
  }

  function syncVisibility() {
    managedTimers.forEach(function (timer) {
      if (document.hidden) timer.suspend();
      else timer.resume();
    });
    document.documentElement.toggleAttribute('data-document-hidden', document.hidden);
  }

  function updateClocks() {
    var value = 'UTC ' + new Date().toISOString().slice(11, 19);
    document.querySelectorAll('[data-utc-clock], [data-clock]').forEach(function (clock) {
      clock.textContent = value;
    });
  }
  function observeMotionRegions() {
    var regions = document.querySelectorAll('[data-motion-region]');
    if (!regions.length || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-paused', !entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '200px 0px' });

    regions.forEach(function (region) { observer.observe(region); });
  }


  syncPointerCapability();
  if (pointerQuery.addEventListener) pointerQuery.addEventListener('change', syncPointerCapability);
  else pointerQuery.addListener(syncPointerCapability);
  document.addEventListener('visibilitychange', syncVisibility);
  observeMotionRegions();

  window.PhoenixRuntime = {
    interval: managedInterval,
    rafThrottle: rafThrottle,
    updateClocks: updateClocks
  };

  managedInterval(updateClocks, 1000, { immediate: true });
  syncVisibility();
}());
