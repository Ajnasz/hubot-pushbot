Hubot-PushBot is an IRC bot that manages the topic in an IRC channel that has a push train.

The base idea is coming from etsy pushbot: https://github.com/etsy/PushBot

Hubot-PushBot is pretty similar with the original, however not one to one replacement.

What is great, that hubot can work with tons of other applications, like Slack or HipChat, and with it you can bring pushbot into your group or company, whatever chat application you're using.

```
.join                           - Starts a pushbot session
.join before <username>         - Starts a new pushbot session and moves before users's session
.join with <username>           - Joins to a pushbot session
.hold <message>                 - Hold session, won't allow to change state or make it done
.unhold                         - Unhold session
.(uhoh|notgood|bad|fuck|fucked) - Mark yourself as not-all-good in the current push state
.(good|ok|in|go|great)          - Mark yourself as all-good in the current push state
.(nm|nevermind|leave)           - Hop out of queue
.message <message text>         - Set session message
.kick <user>                    - Kicks user from session
.at <statename>                 - Changes session state
.done                           - Finishes session
.(drive|lead)                   - Take over leadership of session
.sessions                       - List sessions
.clearplease                    - Remove all sessions (all means all, not only for the room, but from the entire bot)
```

\*Commands are affecting the first session in the queue you are in.
