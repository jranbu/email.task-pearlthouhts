const { performance } = require('perf_hooks');

// Mock email providers
class MockProviderA {
  async sendEmail(email) {
    console.log("Sending email with MockProviderA");
    if (Math.random() < 0.5) throw new Error("Provider A failed");
  }
}

class MockProviderB {
  async sendEmail(email) {
    console.log("Sending email with MockProviderB");
    if (Math.random() < 0.5) throw new Error("Provider B failed");
  }
}

// Rate Limiter
class RateLimiter {
  constructor(rateLimitMs) {
    this.rateLimitMs = rateLimitMs;
    this.lastSent = 0;
  }

  async wait() {
    const now = performance.now();
    const timeSinceLastSend = now - this.lastSent;
    if (timeSinceLastSend < this.rateLimitMs) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitMs - timeSinceLastSend));
    }
    this.lastSent = performance.now();
  }
}

// Circuit Breaker
class CircuitBreaker {
  constructor(threshold, timeout) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  async execute(fn) {
    if (this.failureCount >= this.threshold && performance.now() - this.lastFailureTime < this.timeout) {
      throw new Error("Circuit breaker is open");
    }
    try {
      await fn();
      this.failureCount = 0; // reset on success
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = performance.now();
      throw error;
    }
  }
}

// Email Service
class EmailService {
  constructor(providers, rateLimitMs, threshold, timeout) {
    this.providers = providers;
    this.rateLimiter = new RateLimiter(rateLimitMs);
    this.circuitBreakers = new Map(providers.map(p => [p, new CircuitBreaker(threshold, timeout)]));
    this.sentEmails = new Set();
  }

  async sendWithProvider(provider, email) {
    await this.circuitBreakers.get(provider).execute(() => provider.sendEmail(email));
  }

  async attemptSend(email) {
    for (const provider of this.providers) {
      try {
        await this.sendWithProvider(provider, email);
        console.log("Email sent successfully");
        return;
      } catch (error) {
        console.error(`Failed to send email with ${provider.constructor.name}: ${error.message}`);
      }
    }
    throw new Error("All providers failed");
  }

  async sendEmail(email) {
    const emailId = `${email.to}-${email.subject}-${email.body}`;
    if (this.sentEmails.has(emailId)) {
      console.log("Email already sent, skipping");
      return;
    }
    await this.rateLimiter.wait();
    try {
      await this.attemptSend(email);
      this.sentEmails.add(emailId);
    } catch (error) {
      console.error(`Failed to send email: ${error.message}`);
    }
  }
}

module.exports = { EmailService, MockProviderA, MockProviderB };
