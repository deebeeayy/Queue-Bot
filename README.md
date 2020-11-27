# Debate-Queue-Bot
Created to manage voice channel waiting rooms. This bot allows you to display the order of people waiting and easily pull them to another channel.  

## How to use
**Commands are available to *privileged users* - meaning the server owner, administrators, and users with any of the following roles: `mod`, `moderator`, `admin`, `administrator`.**  
1. **Create a queue.** *Privileged users* can create queues with `!q {channel name}` where `{channel name}` is the name of one of the server's text or voice channels. For example `!q Waiting Room` turns the Waiting Room voice channel into a queue.  
2. **Have users join the queue.** Any user can join text queues by clicking on the queue reaction and join voice queues by joining the matching voice channel.  
3. **Pull users from a queue.** *Privileged users* can be pulled from a text queue using `!n {channel name}`. Pulling users from voice queues requires 2 steps -
	First, use `!s {channel name}` to make the bot join the voice channel.
	Second, drag the bot to the desired location and it will swap with the next person in a queue.
	For example I create a queue using `!q Waiting Room`, then use `!s Waiting Room`, then I drag the bot to an `Among Us` voice channel when the next spot opens up.  
4. **Customization.** *Privileged users* can customize things like the bot's command prefix, message color, messaging mode, and how long people can leave a queue without losing their spot. Use `!h` to see a full list of commands and customization options.

## Commands
Note: If you only have 1 queue, you can skip the channel name argument.
Commands are available to the server owner, administrators, and users with any of the following roles: `mod`, `moderator`, `admin`, `administrator`. Roles containing these words will also grant priveledge, for example: `mod boys`. These keywords can have an `s` attached to the end and have any capitalization, for example: `MODS`. 
| Function | Command | Description |
|-|-|-|
| Create & Destroy Queues | `!q {channel name} {OPTIONAL: size}` | Create or destory a queue for a specified channel. |
| List Queues | `!q` | List the names of the existing queues. | 
| Display a Queue | `!d {channel name}` | Display the members in a queue. These messages stay updated. | 
| Pull from Voice | `!s {channel name}` | Add the bot to a voice queue. Then the bot can be dragged into another channel to automatically pull the person(s) at the front of the queue. If the destination queue has a size limit, the bot will pull people until the limit is met. | 
| Pull from Text | `!n {channel name} {OPTIONAL: amount}` |  Removes people from the text queue and displays their name. |
| Kick | `!k {channel name} @{user 1} @{user 2} ...` | Kick one or more people from a queue. |
| Clear | `!clear {channel name}` | Clear a queue. |
| Shuffle | `!shuffle {channel name}` | Shuffle a queue. |
| Change Queue Size Limit | `!limit {channel name} {size limit}` | Changes queue size limit. |
||||
|**Server Settings**|||
| Change the Command Prefix | `!prefix {new prefix}` | Change the prefix for Queue Bot commands. |
| Change the Color | `!color {new color}` | Change the color of bot messages. |
| Change the Grace Period | `!grace {time in seconds}` | Change how long a person can leave a queue before losing their spot. |
| Change the Display Mode | `!mode {new mode}` | Changes how the display messages are updated. Use `!mode` to see the different update modes.

![Example of `!s`](docs/example.gif)  

## How to setup your own Queue Bot hosting
1. [Create your Discord bot account](https://discordpy.readthedocs.io/en/latest/discord.html)  
2. Clone/download this repository  
3. Create a database for storing queues. Here's a the steps for Windows:  
	3a. [Download Postgresql](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)  
	3b. Run the installer. Use the default port. Skip Stack Builder. Remember the password you set, you will need it later.  
	3c. Open Windows start menu, search for and open SQL Shell (psql).  
	3d. Leave the default login values for Server, Database, Port, and Username.  
	3e. Enter the password you chose during installation.  
	3f. Create a new database. (The semicolon is important):  
		`CREATE DATABASE queue;`  
	3g. Close command prompt.  
4. Open the Queue Bot folder.  
5. Modify `config/config.json`:  
	If you followed all of Step 3, you only need to update the REQUIRED fields in the table below.  
  
| REQUIRED Config Fields | Description                                                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| prefix                 | Command prefix (Default: `!`)                                                                                                     |
| token                  | Bot token. Found in the Discord Developer Portal for the bot you created in Step 1. See image of token location below this table. |
| databasePassword       | Database login password                                                                                                           |
  
| Optional Config Fields | Description                                                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| databaseUsername		 | Database login username (Default: `postgres`)	                                                                                  |
| databaseName           | Database name (Default: `queue`)																				                                        |
| databaseHost           | Database host url (Default: `localhost`)																	                                        |
| databaseType           | Type of database for queue storage. (Default: `postgresql`)                                                                       |
| gracePeriod            | Number of seconds a user can leave the queue without being removed                                                                |
| permissionsRegexp      | What server roles can use bot commands. Uses RegExp. Accepts "mod" and "mods" by default.                                         |
| color                  | The color of bot messages.                                                                                                        |
   
| Config Command Fields  | Description                                                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| clearCmd               | Command to clear the queue.                                                                                                       |
| colorCmd               | Command to change the color.                                                                                                      |
| commandPrefixCmd       | Command to change the command prefix.                                                                                             |
| displayCmd             | Command to display a queue in a text channel.                                                                                     |
| gracePeriodCmd         | Command to change the grace period.                                                                                               |
| helpCmd                | Command to display the help information.                                                                                          |
| kickCmd                | Command to kick users from a queue.                                                                                               |
| limitCmd               | Command to change queue size limit.                                                                                               |
| modeCmd                | Command to change the display messaging mode.                                                                                     |
| nextCmd                | Command to pull the next user from a text channel.                                                                                |
| queueCmd               | Command to change queues.                                                                                                         |
| shuffleCmd             | Command to shuffle the queue.                                                                                                     |
| startCmd               | Command to make the bot join a voice channel.                                                                                     |

![Token Location](docs/token_location.PNG)  

5. [Install NodeJS 12+](https://discordjs.guide/preparations/#installing-node-js)  
6. [Install Node-gyp](https://github.com/nodejs/node-gyp#installation)
7. Install Dependencies. Open commmand prompt in project directory (If you have the project open in file explorer, click on the directory bar, enter `cmd`, and hit enter). Enter `npm i` into command prompt. Keep the command prompt open.  
8. Build the bot. In the same command prompt, enter `npm run build`.  
9. Start the Bot. Enter `npm start` into command prompt. If you get an error at boot, there is something wrong in your config.json. When you close command prompt, the bot will stop.  
10. **Optional**. Make the bot run in the background, so you don't need command prompt open.  
	9a. In command prompt, enter `npm install pm2`  
	9b. To start the bot, enter `pm2 start bot.js --time`  
	9c. To stop the bot, enter `pm2 stop bot.js`  
