# Tools

## Description

Single, specific actions your agent can perform — like looking something up in a data store or sending a notification.

## Detail

**What it is**

One specific action your agent knows how to perform — looking up a record, calculating a total, sending a notification. Many tools belong to a data store: the data store is the source of information, and a tool is one particular thing the agent can do with it.

**What your agent can do with it**

- Notice, on its own, that the action would help answer you
- Carry out the action with the right details filled in
- Use the result to give you a complete, accurate answer

**Example**

You ask _"What's the total for order 1042?"_ Your agent runs its order-lookup tool against the orders database and replies with the actual amount — no guessing, no asking you to check another system.

**Good to know**

Tools let you decide exactly what your agent is allowed to do. Adding a single tool permits just that one action. If you want your agent to have **every** action available for a data store, add the data store itself instead — it brings all of its tools along. Some tools can also be set up to ask for your confirmation before they run.
