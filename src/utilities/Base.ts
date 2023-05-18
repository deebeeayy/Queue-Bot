import { Client, Collection, Guild, GuildMember, LimitedCollection, Snowflake } from "discord.js";
import { ApplicationOptions } from "discord-slash-commands-client";
import { readFileSync, writeFileSync } from "fs";
import { knex } from "knex";
import _ from "lodash";

import { ConfigJson, Timezone } from "./Interfaces";
import { MessageCollection } from "./MessageCollection";

/**
 * The base application class containing the necessary components to run the bot,
 * including the client connection to Discord, the Knex database connection,
 * and the bot configuration.
 */
export class Base {
  /**
   * The bot configuration for this instance.
   */
  static readonly config = this.getJSON("../config/config.json") as ConfigJson;
  
  /**
   * The runnable commands for this instance.
   */
  static readonly commands = this.getJSON("../config/commands-config.json") as ApplicationOptions[];

  /**
   * The version of the commands that was last active for the bot when it was running.
   */
  static readonly lastCommands = (this.getJSON("../data/last-commands-config.json") || []) as ApplicationOptions[];

  /**
   * The timezone configurations for this instance.
   */
  static readonly timeZones = this.getJSON("../data/timezone-list.json") as Timezone[];

  /**
   * This function reads in and parses out JSON from the given file
   * location.
   * @param path The location of the JSON file that needs to be parsed in.
   * @returns The parsed JSON from the file as an object.
   */
  static getJSON(path: string): any {
    const str = readFileSync(path, { encoding: "utf8", flag: "as+" });
    return str ? JSON.parse(str) : undefined;
  }

  /**
   * Concatenated invitation URL after the client identifier has been retrieved 
   * from the configuration.
   */
  static readonly inviteURL =
    `https://discord.com/api/oauth2/authorize?client_id=` +
    Base.config.clientId +
    `&permissions=290475024&scope=applications.commands%20bot`;
  
  /**
   * The Knex library database connection to our current database.
   */
  static readonly knex = knex({
    client: Base.config.databaseType,
    connection: {
      database: Base.config.databaseName,
      host: Base.config.databaseHost,
      password: Base.config.databasePassword,
      user: Base.config.databaseUsername,
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
  });

  /**
   * This application is the client. We need to instantiate a new client
   * with all the required information in order to interact with Discord and
   * its API.
   */
  static readonly client: Client = new Client({
    // makeCache: Options.cacheWithLimits({
    //     MessageManager: {
    //       maxSize: 0,
    //       keepOverLimit: (key: any, value: any) => {
    //         const msg = value as Message;
    //         return msg?.author?.id && msg.author.id !== Base.client.user.id;
    //       }
    //     },
    //     GuildBanManager: 0,
    //     GuildEmojiManager: 0,
    //     PresenceManager: 0,
    //     ReactionManager: 0,
    //     ReactionUserManager: 0,
    //     StageInstanceManager: 0,
    //     ThreadManager: 0,
    //     ThreadMemberManager: 0,
    //   }),
    //
    // sweepers: {
    //   messages: {
    //     interval:     60 * 60,
    //     lifetime: 6 * 60 * 60,
    //   },
    //   guildMembers: {
    //     interval:     60 * 60,
    //     lifetime: 6 * 60 * 60,
    //     filter: (value: GuildMember, key: string, collection: Collection<string, GuildMember>) => {
    //       return true;
    //     }
    //   },
    // },

    // This lambda sets a function to modify the caching behavior of the bot.
    // The given lambda sets a maximum size of the message manager's collection.
    makeCache: (manager) => {
      if (manager.name === "MessageManager") {
        return new MessageCollection({ maxSize: 5 });
      } else if (
        [
          "GuildBanManager",
          "GuildEmojiManager",
          "PresenceManager",
          "ReactionManager",
          "ReactionUserManager",
          "StageInstanceManager",
          "ThreadManager",
          "ThreadMemberManager",
        ].includes(manager.name)
      ) {
        return new LimitedCollection({ maxSize: 0 });
      } else {
        return new Collection();
      }
    },
    // DEPRECATED
    // messageCacheLifetime: 24 * 60 * 60, // Cache messages for 24 hours
    // messageSweepInterval: 1 * 60 * 60, // Sweep every hour
    presence: {
      activities: [
        {
          // Sets the bot to listen for the help command (?)
          type: "LISTENING",
          name: "/help",
        },
      ],
      status: "online",
    },
    intents: ["GUILDS", "GUILD_VOICE_STATES", "GUILD_MESSAGES", "GUILD_MEMBERS"],
    shards: "auto",
  });

  /**
   * This function determines if the given user is the same user
   * as is associated with the bot's identity.
   * @param member The member whose identity we are checking.
   * @returns Whether the given member is the same as the bot's identity.
   */
  public static isMe(member: GuildMember): boolean {
    return member?.id === member?.guild?.me?.id; // TODO: This is deprecated, update.
  }

  /**
   * This function is used to determine if the commands available to the
   * bot have changed since the last time that the bot was run.
   * @returns Whether the bot's commands have changed since its last run.
   */
  public static haveCommandsChanged(): boolean {
    return !_.isEqual(this.commands, this.lastCommands);
  }

  /**
   * This function archives the current existing commands into an archival file
   * used to track and changes to the available commands between this run and the next.
   */
  public static archiveCommands(): void {
    writeFileSync("../data/last-commands-config.json", readFileSync("../config/commands-config.json", { encoding: "utf8" }));
  }

  /**
   * This function takes in a numerical UTC offset and returns the timezone configuration
   * for the timezone associated with that UTC offset.
   * @param utcOffset The UTC offset of the timezone that we are retrieving.
   * @returns The timezone configuration for the timezone associated with the UTC offset.
   */
  public static getTimezone(utcOffset: number): Timezone {
    return this.timeZones.find((t) => t.offset === utcOffset);
  }

  /**
   * This function shuffles a given array using the Fisher-Yates algorithm.
   * @param array The array that we would like to shuffle.
   */
  public static shuffle(array: Collection<Snowflake, Guild> | any[]): void {
    // @ts-ignore
    for (let i = (array.length || array.size) - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]; // Error is because Collection is not numerical. TODO.
    }
  }
}
