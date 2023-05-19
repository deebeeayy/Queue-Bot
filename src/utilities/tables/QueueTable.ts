import { Collection, ColorResolvable, DiscordAPIError, Guild, GuildBasedChannel, GuildMember, Role, Snowflake } from "discord.js";
import { Knex } from "knex";

import { Base } from "../Base";
import { QUEUABLE_VOICE_CHANNELS, StoredQueue } from "../Interfaces";
import { Parsed } from "../ParsingUtils";
import { SchedulingUtils } from "../SchedulingUtils";
import { SlashCommands } from "../SlashCommands";
import { BlackWhiteListTable } from "./BlackWhiteListTable";
import { DisplayChannelTable } from "./DisplayChannelTable";
import { LastPulledTable } from "./LastPulledTable";
import { QueueGuildTable } from "./QueueGuildTable";
import { QueueMemberTable } from "./QueueMemberTable";
import { ScheduleTable } from "./ScheduleTable";

export class QueueTable {
  // Create & update database table if necessary
  public static async initTable() {
    await Base.knex.schema.hasTable("queue_channels").then(async (exists) => {
      if (!exists) {
        await Base.knex.schema
          .createTable("queue_channels", (table) => {
            /**
             * The identifier of this queue.
             */
            table.bigInteger("queue_channel_id").primary();

            /**
             * Whether auto-pull from a queue (voice? TODO) is activated.
             */
            table.integer("auto_fill");

            /**
             * The color of the queue display.
             */
            table.text("color");

            /**
             * Whether to allow pulling when there are less users in the queue than the default pull count.
             */
            table.boolean("enable_partial_pull");

            /**
             * The length of time, in seconds, in which users can leave a queue before losing their position. 
             */
            table.integer("grace_period");

            /**
             * The guild identifier of the Discord server containing this queue.
             */
            table.bigInteger("guild_id");

            /**
             * The header displayed with messages, if set.
             */
            table.text("header");

            /**
             * Whether the join/leave queue button is shown in the GUI.
             */
            table.boolean("hide_button");

            /**
             * Whether the queue is currently locked.
             */
            table.boolean("is_locked");
            
            /**
             * The size limit of the queue.
             */
            table.integer("max_members");

            /**
             * The number of users that should be pulled from a queue by default.
             */
            table.integer("pull_num");

            /**
             * The identifier of the channel where pulled users are sent in a voice queue (TODO)
             */
            table.bigInteger("target_channel_id");

            /**
             * Whether to server mute members that are currently in the queue.
             */
            table.boolean("mute");
          })
          .catch((e) => console.error(e));
      }
    });
  }

  /**
   * This function calls the Knex library to obtain the queue channel
   * that matches the given channel identifier from the database. 
   * @param queueChannelId The channel identifier of the queue channel we are retrieving.
   * @returns The queue channel associated with the given channel identifier.
   */
  public static get(queueChannelId: Snowflake) {
    return Base.knex<StoredQueue>("queue_channels").where("queue_channel_id", queueChannelId).first();
  }

  /**
   * This function calls the Knex library to obtain the guild matching
   * the given guild identifier from the database.
   * @param guildId The guild (server) identifier of the server we are retrieving.
   * @returns The guild associated with the given guild identifier.
   */
  public static getFromGuild(guildId: Snowflake) {
    return Base.knex<StoredQueue>("queue_channels").where("guild_id", guildId);
  }

  /**
   * This function calls the Knex library to obtain the channel that contains
   * the target channel associated with the identifier as its target channel
   * from the database.
   * @param targetChannelId The identifier of the target channel that needs to be defined in the returned channel.
   * @returns The channel defining the target identifier as its target channel.
   */
  public static getFromTarget(targetChannelId: Snowflake) {
    return Base.knex<StoredQueue>("queue_channels").where("target_channel_id", targetChannelId);
  }

  /**
   * This function updates the message that should be shown as the header on messages
   * from the queue associated with the given channel identifier.
   * @param queueChannelId The identifier of the queue on which we are setting the header.
   * @param message The message that should be shown in the header of messages sent from the
   * queue associated with the channel of the identifier.
   */
  public static async setHeader(queueChannelId: Snowflake, message: string) {
    await QueueTable.get(queueChannelId).update("header", message || null);
  }

  /**
   * This function updates whether the Join/Leave button should be shown in the 
   * Discord user interface for the queue associated with the given channel identifier.
   * @param queueChannelId The identifier of the queue on which we are changing the setting.
   * @param hidden Whether the Join/Leave button should be shown in the Discord user interface.
   */
  public static async setHideButton(queueChannelId: Snowflake, hidden: boolean) {
    await QueueTable.get(queueChannelId).update("hide_button", hidden);
  }

  /**
   * This function sets the lock status on the queue associated with the given channel identifier.
   * @param queueChannelId The identifier of the queue on which we are changing the setting.
   * @param is_locked Whether the queue is locked.
   */
  public static async setLock(queueChannelId: Snowflake, is_locked: boolean) {
    await QueueTable.get(queueChannelId).update("is_locked", is_locked);
  }

  /**
   * This function sets the size limit of the queue associated with the given channel identifier. 
   * @param queueChannelId The identifier of the queue on which we are changing the setting.
   * @param max The size limit that should be set on the queue.
   */
  public static async setMaxMembers(queueChannelId: Snowflake, max: number) {
    await QueueTable.get(queueChannelId).update("max_members", max);
  }

  /**
   * This function sets or updates the target channel for the queue associated with the 
   * given channel identifier.
   * @param queueChannelId The identifier of the queue on which we are changing the target channel.
   * @param targetChannelId The identifier of the channel which we would like to use as the target
   * channel for this queue.
   */
  public static async setTarget(queueChannelId: Snowflake, targetChannelId: Snowflake | Knex.Raw) {
    await QueueTable.get(queueChannelId).update("target_channel_id", targetChannelId);
  }

  /**
   * This function sets or updates the display color for the queue associated with
   * the given channel identifier.
   * @param queueChannel The identifier of the queue whose display color we are changing.
   * @param value The color value that we would like to set the queue to.
   */
  public static async setColor(queueChannel: GuildBasedChannel, value: ColorResolvable) {
    // TODO: Why get the queue twice -- once to update, once for the role?
    await QueueTable.get(queueChannel.id).update("color", value);
    const storedQueue = await QueueTable.get(queueChannel.id);
    
    // If the queue contains an associated role, set the color on the role as well? TODO
    if (storedQueue?.role_id) {
      const role = await queueChannel.guild.roles.fetch(storedQueue.role_id).catch(() => null as Role);
      await role?.setColor(value).catch(() => null);
    }
  }

  /**
   * This function sets or updates the period of time, in seconds, that can pass before a 
   * user that has left the queue loses their position in the queue associated with the 
   * given identifier.
   * @param queueChannelId The identifier of the queue on which we are setting the grace period.
   * @param value The amount of time, in seconds, that can pass before a user that has left the queue
   * loses their position in the queue.
   */
  public static async setGraceperiod(queueChannelId: Snowflake, value: number) {
    await QueueTable.get(queueChannelId).update("grace_period", value);
  }

  /**
   * This function sets whether auto-pulling should be enabled for the queue
   * associated with the channel identifier.
   * @param queueChannelId The identifier of the queue on which we are changing the setting.
   * @param value Whether auto-pulling should be enabled for this queue.
   */
  public static async setAutopull(queueChannelId: Snowflake, value: boolean) {
    await QueueTable.get(queueChannelId).update("auto_fill", value ? 1 : 0);
  }

  /**
   * This function sets the number of people that should be pulled from the queue associated
   * with the given identifier by default. It also allows for enabling and disabling
   * whether pulling from the given queue is allowed when there are less people in the
   * queue than the default pull amount.
   * @param queueChannelId The identifier of the queue on which we are setting the pull count.
   * @param number The number of people that should be pulled from a queue by default.
   * @param enable_partial_pulling Whether pulling is allowed when there are less people in
   * the queue than the default pull count.
   */
  public static async setPullnum(queueChannelId: Snowflake, number: number, enable_partial_pulling: boolean) {
    await QueueTable.get(queueChannelId).update("pull_num", number).update("enable_partial_pull", enable_partial_pulling);
  }

  /**
   * This function updates the role identifier of the role associated with
   * members of the queue when the queue role setting is enabled. If there are
   * people in the queue, those queue members have their role updated as well.
   * @param queueChannel The queue object on which we are updating the associated role.
   * @param role The role which is to be associated to the queue and its members.
   */
  public static async setRoleId(queueChannel: GuildBasedChannel, role: Role) {
    await QueueTable.get(queueChannel.id).update("role_id", role.id);
    const queueMembers = await QueueMemberTable.getFromQueueUnordered(queueChannel);
    for await (const queueMember of queueMembers) {
      const member = await QueueMemberTable.getMemberFromQueueMemberId(queueChannel, queueMember.member_id);
      if (!member) {
        continue;
      }
      await member.roles.add(role);
    }
  }

  /**
   * This function updates whether people currently in the queue associated with the
   * given identifier should be server muted.
   * @param queueChannelId The identifier of the queue on which we are changing the setting.
   * @param value Whether people currently in the queue should be server muted.
   */
  public static async setMute(queueChannelId: Snowflake, value: boolean) {
    await QueueTable.get(queueChannelId).update("mute", value ? 1 : 0);
  }

  /**
   * This function removes a role association from the queue, stopping the role
   * from being associated with members currently in the queue.
   * @param queueChannel The queue from which we are removing the role association.
   */
  public static async deleteRoleId(queueChannel: GuildBasedChannel) {
    await QueueTable.get(queueChannel.id).update("role_id", Base.knex.raw("DEFAULT"));
  }

  /**
   * This function retrieves a mapping of queue channel identifiers to their associated
   * channels that are linked to the given Discord server. Additionally, it will perform
   * cleanup on the queue channels associated with the server in the database to remove
   * any that have been deleted.
   * @param guild The Discord server from which we are retrieving the queue channels.
   * @returns A mapping of channel identifiers to channels that belong to the given
   * Discord server.
   */
  public static async fetchFromGuild(guild: Guild): Promise<Collection<Snowflake, GuildBasedChannel>> {
    const queueChannelIdsToRemove: Snowflake[] = [];
    // Fetch stored channels
    const storedQueues = await Base.knex<StoredQueue>("queue_channels").where("guild_id", guild.id);
    const queueChannels: Collection<Snowflake, GuildBasedChannel> = new Collection();
    // Check for deleted channels
    // Going backwards allows the removal of entries while visiting each one
    for (let i = storedQueues.length - 1; i >= 0; i--) {
      const queueChannelId = storedQueues[i].queue_channel_id;
      const queueChannel = guild.channels.cache.find((s) => s.id === queueChannelId);
      if (queueChannel) {
        // Still exists, add to return list
        queueChannels.set(queueChannelId, queueChannel);
      } else {
        // Channel has been deleted, update database
        queueChannelIdsToRemove.push(queueChannelId);
      }
    }
    for await (const queueChannelId of queueChannelIdsToRemove) {
      await QueueTable.unstore(guild.id, queueChannelId);
    }
    return queueChannels;
  }

  public static async createQueueRole(parsed: Parsed, channel: GuildBasedChannel, color: ColorResolvable): Promise<Role> {
    let prefix = (await QueueGuildTable.get(channel.guildId)).role_prefix;
    const role = await channel.guild.roles
      .create({
        color: color,
        mentionable: true,
        name: (prefix == null ? "In queue: " : prefix) + channel.name,
      })
      .catch(async (e: DiscordAPIError) => {
        if ([403, 404].includes(e.httpStatus)) {
          await parsed
            .reply({
              content:
                "WARNING: I could not create a server role. If you want queue members to receive a role, follow these steps:" +
                "\n1. Grant me the Manage Roles permission **or** click the link below." +
                "\n2. Then use `/display` to create role.",
              embeds: [
                {
                  title: "Update Permission",
                  url: Base.inviteURL,
                },
              ],
              commandDisplay: "EPHEMERAL",
            })
            .catch(() => null);
          return null;
        }
      });
    if (role) {
      await QueueTable.setRoleId(channel, role);
    }
    return role;
  }

  public static async deleteQueueRole(guildId: Snowflake, channel: StoredQueue, parsed?: Parsed) {
    await QueueTable.get(channel.queue_channel_id).update("role_id", Base.knex.raw("DEFAULT"));
    const roleId = channel?.role_id;
    if (roleId) {
      const guild = await Base.client.guilds.fetch(guildId).catch(() => null as Guild);
      if (guild) {
        const role = await guild.roles.fetch(roleId).catch(() => null as Role);
        await role?.delete().catch(async (e: DiscordAPIError) => {
          if ([403, 404].includes(e.httpStatus)) {
            await parsed
              ?.reply({
                content: `ERROR: Failed to delete server role for queue. Please:\n1. Grant me the Manage Roles permission **or** click this link\n2. Manually delete the \`${role.name}\` role`,
                embeds: [
                  {
                    title: "Update Permission",
                    url: Base.inviteURL,
                  },
                ],
                commandDisplay: "EPHEMERAL",
              })
              .catch(console.error);
          }
        });
      }
    }
  }

  public static async store(parsed: Parsed, channel: GuildBasedChannel, maxMembers?: number) {
    // Store
    await Base.knex<StoredQueue>("queue_channels").insert({
      auto_fill: 1,
      color: Base.config.color,
      grace_period: Base.config.gracePeriod,
      guild_id: parsed.storedGuild.guild_id,
      max_members: maxMembers,
      pull_num: 1,
      queue_channel_id: channel.id,
    });
    // @ts-ignore
    if (QUEUABLE_VOICE_CHANNELS.includes(channel.type)) {
      const members = channel.members as Collection<string, GuildMember>;
      for await (const member of members.filter((member) => !member.user.bot).values()) {
        await QueueMemberTable.store(channel, member).catch(() => null);
      }
    }

    // Timeout for message order
    setTimeout(() => SlashCommands.modifyCommandsForGuild(parsed.request.guild, parsed).catch(() => null), 500);
    if ((await QueueTable.getFromGuild(parsed.request.guildId)).length > 25) {
      await parsed.reply({
        content:
          `WARNING: ${
            channel.guild || "**" + channel.name + "**"
          } will not be available in slash commands due to a Discord limit of 25 choices per command parameter. ` +
          ` To interact with this new queue, you must delete another queue.`,
      });
    }
  }

  public static async unstore(guildId: Snowflake, channelId?: Snowflake, parsed?: Parsed) {
    let query = Base.knex<StoredQueue>("queue_channels").where("guild_id", guildId);
    // Delete store db entries
    if (channelId) {
      query = query.where("queue_channel_id", channelId);
    }
    const queueChannels = await query;

    const promises = [];
    for (const queueChannel of queueChannels) {
      promises.push(
        QueueTable.deleteQueueRole(guildId, queueChannel, parsed),
        BlackWhiteListTable.unstore(2, queueChannel.queue_channel_id),
        DisplayChannelTable.unstore(queueChannel.queue_channel_id),
        QueueMemberTable.unstore(guildId, queueChannel.queue_channel_id),
        ScheduleTable.unstore(queueChannel.queue_channel_id),
      );
    }
    await Promise.all(promises);
    await query.delete();

    // Timeout for message order
    const guild = await Base.client.guilds.fetch(guildId).catch(() => null as Guild);
    if (guild) {
      setTimeout(() => SlashCommands.modifyCommandsForGuild(guild, parsed).catch(() => null), 500);
    }
  }

  public static async validate(
    requireGuildUpdate: boolean,
    guild: Guild,
    channels: Collection<Snowflake, GuildBasedChannel>,
    members: Collection<Snowflake, GuildMember>,
    roles: Collection<Snowflake, Role>,
  ) {
    const storedEntries = await QueueTable.getFromGuild(guild.id);
    for await (const entry of storedEntries) {
      let requireChannelUpdate = false;
      const queueChannel = channels.find((c) => c?.id === entry.queue_channel_id);
      if (queueChannel) {
        Base.client.guilds.cache.get(guild.id).channels.cache.set(queueChannel.id, queueChannel); // cache
        guild.channels.cache.set(queueChannel.id, queueChannel); // cache
        const results = await Promise.all([
          BlackWhiteListTable.validate(queueChannel, members, roles),
          DisplayChannelTable.validate(guild, queueChannel, channels),
          LastPulledTable.validate(queueChannel, members),
          ScheduleTable.validate(queueChannel, channels),
          QueueMemberTable.validate(queueChannel, members),
        ]);
        if (results.includes(true)) {
          requireChannelUpdate = true;
        }
      } else {
        await QueueTable.unstore(guild.id, entry.queue_channel_id);
        requireChannelUpdate = true;
      }
      if (requireGuildUpdate || requireChannelUpdate) {
        // If visual data has been unstored, schedule a display update.
        const storedGuild = await QueueGuildTable.get(guild.id);
        await SchedulingUtils.scheduleDisplayUpdate(storedGuild, queueChannel);
      }
    }
  }
}
