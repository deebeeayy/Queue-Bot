import { Guild, Snowflake } from "discord.js";
import { Knex } from "knex";

import { Base } from "../Base";
import { StoredGuild } from "../Interfaces";
import { AdminPermissionTable } from "./AdminPermissionTable";
import { PriorityTable } from "./PriorityTable";
import { QueueTable } from "./QueueTable";

/**
 * This class represents a record from the queue_guilds table,
 * which stores the Discord servers that have added the bot and the 
 * settings for the bot associated with that server.
 */
export class QueueGuildTable {
  /**
   * Create and/or update the database as is necessary.
   */
  public static async initTable() {
    await Base.knex.schema.hasTable("queue_guilds").then(async (exists) => {
      if (!exists) {
        await Base.knex.schema
          .createTable("queue_guilds", (table) => {
            table.bigInteger("guild_id").primary();
            table.boolean("disable_mentions");
            table.boolean("disable_notifications");
            table.boolean("disable_roles");
            table.bigInteger("logging_channel_id");
            table.integer("logging_channel_level");
            table.integer("msg_mode");
            table.text("role_prefix");
            table.text("timestamps").defaultTo("off");
          })
          .catch((e) => console.error(e));
      }
    });
  }

  /**
   * This function retrieves the server associated with the given guild identifier
   * from the database.
   * @param guildId The guild identifier of the server that we are attempting to retrieve.
   * @returns The Discord server associated with the guild identifier.
   */
  public static get(guildId: Snowflake) {
    return Base.knex<StoredGuild>("queue_guilds").where("guild_id", guildId).first();
  }

  /**
   * This function updates the disable mentions setting of the server associated with
   * the given guild identifier using the given value.
   * @param guildId The guild identifier of the server on which we are changing the setting.
   * @param value The new value of the disable mentions setting.
   */
  public static async setDisableMentions(guildId: Snowflake, value: boolean) {
    await QueueGuildTable.get(guildId).update("disable_mentions", value);
  }

  /**
   * This function updates the disable notifications setting of the server associated
   * with the given guild identifer using the given value.
   * @param guildId The guild identifier of the server on which we are changing the setting.
   * @param value The new value of the disable notifications setting.
   */
  public static async setDisableNotifications(guildId: Snowflake, value: boolean) {
    await QueueGuildTable.get(guildId).update("disable_notifications", value);
  }

  /**
   * This function updates the disable roles setting of the server associated
   * with the given guild identifier using the given value.
   * @param guildId The guild identifier of the server on which we are changing the setting.
   * @param value The new value of the disable roles setting.
   */
  public static async setDisableRoles(guildId: Snowflake, value: boolean) {
    await QueueGuildTable.get(guildId).update("disable_roles", value);
  }

  /**
   * This function updates the channel that is being used as the logging channel
   * on the server associated with the given guild identifier and/or the amount
   * of logs that should be output based on the importance of the individual log messages.
   * @param guildId The guild identifier of the server on which we are changing the setting.
   * @param channelId The channel identifier of the channel which we want to set as the logging channel.
   * @param level How much logging the application should do based on the importance of the message.
   */
  public static async setLoggingChannel(guildId: Snowflake, channelId: Snowflake | Knex.Raw, level: "default" | "everything") {
    const loggingNum = level === "everything" ? 1 : 0;
    await QueueGuildTable.get(guildId).update("logging_channel_id", channelId).update("logging_channel_level", loggingNum);
  }

  /**
   * This function updates the mode which the bot uses to display messages on the
   * server associated with the guild identifier received.
   * - 1 - Old display messages are edited. (DEFAULT)
   * - 2 - New display messages are sent and old ones are deleted.
   * - 3 - New display messages are sent. 
   * @param guildId The guild identifier of the server on which we are changing the setting.
   * @param mode The display mode that we would like the bot to use for this server.
   */
  public static async setMessageMode(guildId: Snowflake, mode: number) {
    await QueueGuildTable.get(guildId).update("msg_mode", mode);
  }

  /**
   * This function updates whether timestamps are displayed next to users
   * on the server associated with the guild identifier received.
   * @param guildId The guild identifier of the server on which we are changing the setting.
   * @param value Whether timestamps are displayed next to users.
   */
  public static async setTimestamps(guildId: Snowflake, value: string) {
    await QueueGuildTable.get(guildId).update("timestamps", value);
  }

  /**
   * This function updates the role prefix associated with the server associated
   * with the guild identifier given when the role assignment for queues setting
   * is enabled.
   * @param guildId The guild identifier of the server on which we are changing the setting.
   * @param value The role prefix used for the role assigned to users in a queue if the role
   * assignment setting is enabled.
   */
  public static async setRolePrefix(guildId: Snowflake, value: string) {
    await QueueGuildTable.get(guildId).update("role_prefix", value);
  }

  /**
   * This function creates a new record for the given server.
   * @param guild The server that we would like to store into the database.
   */
  public static async store(guild: Guild) {
    await Base.knex<StoredGuild>("queue_guilds").insert({ guild_id: guild.id, msg_mode: 1 });
  }

  /**
   * This function removes the record for the server associated with the guild
   * identifier given.
   * @param guildId The guild identifier of the server we want to remove.
   */
  public static async unstore(guildId: Snowflake) {
    await QueueTable.unstore(guildId);
    await AdminPermissionTable.unstore(guildId);
    await PriorityTable.unstore(guildId);
    await Base.knex<StoredGuild>("queue_guilds").where("guild_id", guildId).delete();
  }
}
