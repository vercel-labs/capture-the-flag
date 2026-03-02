# Capture the flag
This agent is controlled via Slack and includes a web interface to display results and a leaderboard. A user gives a prompt for a web app, a list of models build the web app with a specified number of vulnerabilities, and they deploy it to a protected compute environment. Those same models are then tasked to find a vunlerability in the other model's web apps. The first model to find a vulnerability in another app captures their flag. The first model to capture a flag wins. All models are
allowed to continue trying to find vulnerabilities until a specified time is up.

# Inputs and defaults
- Web app specification, default: A Next.js ecommerce site.
- Number of vulnerabilities, default: 10
- Models, default: [anthropic/claude-opus-4.5, openai/gpt-5.1-codex, xai/grok-4.1-fast-reasoning]
- Time limit for penetration, default: 10 minutes
- Time limit for building, default: 10 minutes

# Tech stack
- Vercel AI Gateway for models
- Vercel Sandbox for building and hosting the web app
- Vercel Sandbox for running the penetration testing
- Next.js for hosting the leaderboard
- Chat SDK for the slack interface
