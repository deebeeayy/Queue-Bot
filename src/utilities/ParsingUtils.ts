import {
  Collection,
  CommandInteraction,
  CommandInteractionOption,
  GuildBasedChannel,
  GuildMember,
  InteractionReplyOptions,
  Message,
  MessageEmbedOptions,
  MessageMentionOptions,
  Role,
  Snowflake,
} from "discord.js";

import { Base } from "./Base";
import {
  QUEUABLE_CHANNELS,
  QUEUABLE_TEXT_CHANNELS,
  QUEUABLE_VOICE_CHANNELS,
  QueuableTextChannelTypes,
  QueuableVoiceChannelTypes,
  QueuePair,
  RequiredType,
  StoredGuild,
  StoredQueue,
} from "./Interfaces";
import { MessagingUtils } from "./MessagingUtils";
import { AdminPermissionTable } from "./tables/AdminPermissionTable";
import { QueueGuildTable } from "./tables/QueueGuildTable";
import { QueueTable } from "./tables/QueueTable";

export class ParsingUtils {
  private static regEx = RegExp(Base.config.permissionsRegexp, "i");
  /**
   * Determine whether user has permission to interact with bot
   */
  public static async checkPermission(request: CommandInteraction | Message): Promise<boolean> {
    try {
      const member = request.member as GuildMember;
      if (!member) {
        return false;
      }
      // Check if ADMIN
      if (member.permissionsIn(request.channel as GuildBasedChannel)?.has("ADMINISTRATOR")) {
        return true;
      }
      // Check IDs
      const permissionEntries = await AdminPermissionTable.getMany(request.guildId);
      for (const entry of permissionEntries) {
        if (member.roles.cache.has(entry.role_member_id) || member.id === entry.role_member_id) {
          return true;
        }
      }
      // Check role names
      const roles = member.roles.cache.values();
      for (const role of roles) {
        if (this.regEx.test(role.name)) {
          return true;
        }
      }
    } catch (e: any) {
      // Empty
    }
    // False if no matches
    return false;
  }
}

interface ReplyOptions {
  messageDisplay?: "NONE" | "DM";
  commandDisplay?: "EPHEMERAL";
  content?: string;
  embeds?: MessageEmbedOptions[];
  allowMentions?: boolean;
}

interface RequiredOptions {
  command: string;

  channel?: {
    required?: RequiredType; // OPTIONAL means "All" queues are an accepted channel arg
    type?: (QueuableTextChannelTypes | number | QueuableVoiceChannelTypes)[];
  };
  members?: RequiredType;
  roles?: RequiredType;
  strings?: RequiredType;
  numbers?: {
    required?: RequiredType;
    min: number;
    max: number;
    defaultValue?: number;
  };
  booleans?: RequiredType;
}

export class Parsed {
  public args: {
    channels?: GuildBasedChannel[];
    members?: Collection<Snowflake, GuildMember>;
    roles?: Collection<Snowflake, Role>;
    strings: string[];
    numbers: number[];
    booleans: boolean[];
  };
  public command: string;
  public request: CommandInteraction;
  public storedGuild: StoredGuild;
  public hasPermission: boolean;
  protected cachedChannels: Collection<string, GuildBasedChannel>;
  protected cachedQueues: StoredQueue[];
  protected cachedQueueChannels: QueuePair[];

  constructor(command: CommandInteraction) {
    this.args = {
      strings: [],
      numbers: [],
      booleans: [],
    };
    this.request = command;
  }

  /**
   * This function takes the this parsed interaction and retrieves the input command
   * and all of its arguments in the form of a string array. 
   * @param conf The values that are required in the command for this call.
   * @returns A promise containing the parsed command and input arguments.
   */
  public async parseArgs(conf: RequiredOptions): Promise<string[]> {
    // In JavaScript-isms, if (instance) indicates "if an object is null or undefined"
    this.command = conf.command;

    // Strings, always required
    this.args.strings = this.findArgs(this.request.options.data, "STRING") as string[];
    
    // Numbers, only when included as required
    if (conf.numbers) {
      this.args.numbers = this.findArgs(this.request.options.data, "INTEGER") as number[];
    }

    // Booleans
    if (conf.booleans) {
      this.args.booleans = this.findArgs(this.request.options.data, "BOOLEAN") as boolean[];
    }

    // Guild (Server) Members
    if (conf.members) {
      this.args.members = new Collection<Snowflake, GuildMember>();
      const members = this.findArgs(this.request.options.data, "USER") as GuildMember[];
      members.forEach((member) => {
        // Place the ID and member object from the arguments in the parsed arguments.
        if (member) this.args.members.set(member.id, member);
      });
    }

    // Guild Roles
    if (conf.roles) {
      this.args.roles = new Collection<Snowflake, Role>();
      const roles = this.findArgs(this.request.options.data, "ROLE") as Role[];
      roles.forEach((role) => {
        // Please the ID and role object from the arguments in the parsed arguments.
        if (role) this.args.roles.set(role.id, role);
      });
    }

    // Guild Channels
    if (conf.channel) {
      let channel = this.findArgs(this.request.options.data, "CHANNEL")[0] as GuildBasedChannel;

      // We only want to place the channel in the parsed arguments if the channel is of
      // a type that we are able to use as a queue.
      // @ts-ignore
      if (channel && QUEUABLE_CHANNELS.includes(channel.type)) {
        this.args.channels = [channel];
      } else {
        let channels = await this.getQueueChannels();
        if (conf.channel.type) {
          // @ts-ignore
          channels = channels.filter((ch) => conf.channel.type.includes(ch.type));
        }
        if (channels.length === 1) {
          this.args.channels = channels;
        } else {
          if (this.args.strings[0] === "ALL") {
            this.args.channels = channels;
          } else {
            channel = channels.find((ch) => ch?.id === this.args.strings[0]);
            if (channel) {
              this.args.channels = [channel];
            }
          }
          if (this.args.channels) {
            this.args.strings.splice(0, 1); // Channel found by plaintext. remove it from args
          }
        }
      }
    }

    // Return any missing arguments to the calling function.
    return this.verifyArgs(conf);
  }

  public async reply(options: ReplyOptions): Promise<Message> {
    const mentions: MessageMentionOptions = options.allowMentions ? null : { parse: [] };
    const isEphemeral = options.commandDisplay === "EPHEMERAL";
    const message: InteractionReplyOptions = {
      allowedMentions: mentions,
      content: options.content,
      embeds: options.embeds,
      ephemeral: isEphemeral,
      fetchReply: !isEphemeral,
    };

    await MessagingUtils.logToLoggingChannel(
      this.command,
      options.content,
      this.request.member as GuildMember,
      this.storedGuild,
      isEphemeral,
    );

    if (this.request.replied) {
      return (await this.request.followUp(message)) as Message;
    } else if (this.request.deferred) {
      return (await this.request.editReply(message)) as Message;
    } else {
      return (await this.request.reply(message)) as unknown as Message;
    }
  }

  private findArgs(options: Readonly<CommandInteractionOption[]>, type: string, accumulator: any[] = []): any[] {
    for (const option of options) {
      if ((option.type === "SUB_COMMAND" || option.type === "SUB_COMMAND_GROUP") && option.options?.length) {
        accumulator = this.findArgs(option.options, type, accumulator);
      } else if (option.type === type) {
        if (["CHANNEL"].includes(type)) {
          accumulator.push(option.channel);
        } else if (["USER"].includes(type)) {
          accumulator.push(option.member);
        } else if (["ROLE"].includes(type)) {
          accumulator.push(option.role);
        } else {
          accumulator.push(option.value);
        }
      }
    }
    return accumulator;
  }

  public get member(): GuildMember {
    return this.args.members ? [...this.args.members.values()][0] : undefined;
  }

  public get role(): Role {
    return this.args.roles ? [...this.args.roles.values()][0] : undefined;
  }

  public get channel(): GuildBasedChannel {
    return this.args.channels?.[0];
  }

  public get channelNames(): string {
    return this.args.channels?.map((c) => "`" + c.name + "`").join(", ");
  }

  public get string(): string {
    return this.args.strings?.[0];
  }

  public get number(): number {
    return this.args.numbers?.[0];
  }

  public get boolean(): boolean {
    return this.args.booleans?.[0];
  }

  public async setup() {
    this.storedGuild = await QueueGuildTable.get(this.request.guildId);
    if (!this.storedGuild) {
      await QueueGuildTable.store(this.request.guild);
      this.storedGuild = await QueueGuildTable.get(this.request.guildId);
    }
    this.hasPermission = await ParsingUtils.checkPermission(this.request);
  }

  protected async verifyArgs(conf: RequiredOptions): Promise<string[]> {
    const missingArgs = [];
    if (conf.channel?.required && !this.args.channels) {
      missingArgs.push(
        // @ts-ignore
        (QUEUABLE_TEXT_CHANNELS.includes(conf.channel.type) ? "**text** " : "") +
          // @ts-ignore
          (QUEUABLE_VOICE_CHANNELS.includes(conf.channel.type) ? "**voice** " : "") +
          "channel",
      );
    }
    if (conf.roles === RequiredType.REQUIRED && !this.args.roles) {
      missingArgs.push("role");
    }
    if (conf.members === RequiredType.REQUIRED && !this.args.members?.size) {
      missingArgs.push("member");
    }
    if (conf.numbers?.required === RequiredType.REQUIRED) {
      if (this.args.numbers.length) {
        // TODO: Need to account for an undefined defaultValue.
        this.verifyNumber(conf.numbers.min, conf.numbers.max, conf.numbers.defaultValue);
      } else {
        missingArgs.push("number");
      }
    }
    if (conf.strings === RequiredType.REQUIRED && !this.args.strings.length) {
      missingArgs.push("string");
    }
    if (conf.booleans === RequiredType.REQUIRED && !this.args.booleans.length) {
      missingArgs.push("boolean");
    }

    // 0 == true - If there exist missing arguments, reply with an object containing the error message.
    if (missingArgs.length) {
      await this.reply({
        content: "**ERROR**: Missing " + missingArgs.join(" and ") + " argument" + (missingArgs.length > 1 ? "s." : "."),
        commandDisplay: "EPHEMERAL",
      }).catch(() => null);
    }

    // Return the missing arguments to the caller function.
    return missingArgs;
  }

  /**
   * Get stored queues as StoredQueue[]
   */
  private async getStoredQueues(): Promise<StoredQueue[]> {
    if (this.cachedQueues === undefined) {
      this.cachedQueues = await QueueTable.getFromGuild(this.request.guildId);
    }
    return this.cachedQueues;
  }

  public async getQueueChannels(): Promise<GuildBasedChannel[]> {
    return (await this.getQueuePairs()).map((pair) => pair.channel);
  }

  /**
   * Get queues as QueuePair[]
   */
  public async getQueuePairs(): Promise<QueuePair[]> {
    const storedQueues = await this.getStoredQueues();
    const channels = await this.getChannels();
    if (!this.cachedQueueChannels) {
      this.cachedQueueChannels = storedQueues.map((stored) => ({
        stored: stored,
        channel: channels.find((ch) => ch.id === stored.queue_channel_id),
      }));
    }
    return this.cachedQueueChannels;
  }

  /**
   * Get all channels as GuildBasedChannel
   */
  public async getChannels(): Promise<Collection<string, GuildBasedChannel>> {
    return (this.cachedChannels =
      this.cachedChannels ||
      // @ts-ignore
      (await this.request.guild.channels.fetch()).filter((ch) => QUEUABLE_CHANNELS.includes(ch?.type)));
  }

  protected verifyNumber(min: number, max: number, defaultValue: number): void {
    for (let i = 0; i < this.args.numbers.length; i++) {
      let number = this.args.numbers[i];
      this.args.numbers[i] = number ? Math.max(Math.min(number as number, max), min) : defaultValue;
    }
  }
}
