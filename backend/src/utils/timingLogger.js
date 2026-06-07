// backend/src/utils/timingLogger.js
class TimingLogger {
  constructor(jobId) {
    this.jobId = jobId;
    this.startTimes = {};
    this.endTimes = {};
    this.phases = {};
  }

  start(phase) {
    const now = Date.now();
    this.startTimes[phase] = now;
    console.log(`[Timing] ${this.jobId} | ${phase} | start | ${new Date(now).toISOString()}`);
  }

  end(phase) {
    const now = Date.now();
    this.endTimes[phase] = now;
    const duration = now - (this.startTimes[phase] || now);
    this.phases[phase] = duration;
    console.log(`[Timing] ${this.jobId} | ${phase} | end | ${new Date(now).toISOString()} | duration ${duration}ms`);
  }

  record(name, duration, extra = {}) {
    console.log(`[Timing] ${this.jobId} | ${name} | ${duration}ms`, extra);
  }

  summary() {
    console.log(`\n[Timing] ${this.jobId} | Execution Summary`);
    console.log(`─────────────────`);
    for (const [phase, duration] of Object.entries(this.phases)) {
      console.log(`${phase}: ${duration} ms`);
    }
    const total = Object.values(this.phases).reduce((a, b) => a + b, 0);
    console.log(`Total Execution Time: ${total} ms`);
  }
}

module.exports = TimingLogger;