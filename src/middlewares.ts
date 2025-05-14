import { BadRequestException, Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Response, Request, NextFunction } from 'express';
import { routes } from './routes';
import { z, ZodSchema } from "zod";
/**
 * Интерфейс входящего запроса от Яндекс Диалогов
 * @see https://yandex.ru/dev/dialogs/alice/doc/ru/request [Официальная документация]
 */
interface AliceRequest<T> {
    /**
     * Мета-информация об устройстве и окружении пользователя
     */
    meta: {
        /** Локаль устройства (например, ru-RU) */
        locale: string;
        /** Часовой пояс (например, Europe/Moscow) */
        timezone: string;
        /** Идентификатор клиентского приложения */
        client_id: string;
        /** 
         * Доступные интерфейсы устройства
         * @property {object} [screen] - Наличие экрана
         * @property {object} [account_linking] - Возможность связки аккаунтов
         * @property {object} [audio_player] - Возможность воспроизведения аудио
         */
        interfaces: {
            screen?: Record<string, never>;
            account_linking?: Record<string, never>;
            audio_player?: Record<string, never>;
        };
    };

    /**
     * Информация о запросе пользователя
     */
    request?: {
        /** Тип входящего запроса */
        type: 'SimpleUtterance' | 'ButtonPressed' | 'Purchase.Confirmation' | 'Show.Pull';
        /** Текст команды после активации навыка */
        command: string;
        /** Полный оригинальный текст запроса */
        original_utterance: string;
        /** 
         * Информация о потенциально опасном содержании
         * @property {boolean} [dangerous_context] - Флаг опасного контекста
         */
        markup?: {
            dangerous_context?: boolean;
        };
        /** 
         * Результаты обработки естественного языка (NLU)
         * @see https://yandex.ru/dev/dialogs/alice/doc/nlu.html [Документация NLU]
         */
        nlu: {
            /** Токенизированный текст запроса */
            tokens: string[];
            /** Распознанные сущности */
            entities: Array<{
                /** Тип сущности (YANDEX.DATETIME, YANDEX.FIO и т.д.) */
                type: string;
                /** Позиции сущности в токенах */
                tokens: {
                    start: number;
                    end: number;
                };
                /** Значение сущности (зависит от типа) */
                value: string | number | boolean | Record<string, unknown>;
            }>;
            /** 
             * Распознанные интенты (намерения)
             * @example { "YANDEX.CONFIRM": { slots: {} } }
             */
            intents?: Record<string, {
                /** Слоты интента */
                slots: Record<string, {
                    /** Тип значения слота */
                    type: string;
                    /** Значение слота */
                    value: string | number | boolean;
                }>;
            }>;
        };
    };

    /**
     * Информация о сессии
     */
    session: {
        /** Счетчик сообщений в сессии */
        message_id: number;
        /** Уникальный идентификатор сессии */
        session_id: string;
        /** Идентификатор навыка */
        skill_id: string;
        /** 
         * Информация о пользователе
         * @property {string} user_id - Уникальный идентификатор пользователя
         * @property {string} [access_token] - OAuth-токен для авторизации
         */
        user?: {
            user_id: string;
            access_token?: string;
        };
        /** 
         * Информация о приложении
         * @property {string} application_id - Идентификатор экземпляра приложения
         */
        application: {
            application_id: string;
        };
        /** Флаг новой сессии */
        new: boolean;
    };

    /**
     * Состояние навыка
     */
    state: {
        /** Состояние сессии */
        session?: T;
        /** Состояние пользователя */
        user?: Record<string, unknown>;
        /** Состояние приложения */
        application?: Record<string, unknown>;
    };

    /** Версия протокола (текущая: 1.0) */
    version: string;
}

interface NextHandler {
    nextHandler?: string,
}

// Вынесем схемы валидации в отдельный файл validation/schemas.ts
const SessionSchema = z.object({
    nextHandler: z.string().optional()
});

export const AliceRequestSchema = <T extends ZodSchema>(sessionSchema: T) =>
    z.object({
        meta: z.object({
            locale: z.string(),
            timezone: z.string(),
            client_id: z.string(),
            interfaces: z.object({
                screen: z.object({}).optional(),
                account_linking: z.object({}).optional(),
                audio_player: z.object({}).optional()
            })
        }),
        request: z.object({
            type: z.enum(['SimpleUtterance', 'ButtonPressed', 'Purchase.Confirmation', 'Show.Pull']),
            command: z.string(),
            original_utterance: z.string(),
            markup: z.object({
                dangerous_context: z.boolean().optional()
            }).optional(),
            nlu: z.object({
                tokens: z.array(z.string()),
                entities: z.array(
                    z.object({
                        type: z.string(),
                        tokens: z.object({ start: z.number(), end: z.number() }),
                        value: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown())])
                    })
                ),
                intents: z.record(
                    z.object({
                        slots: z.record(
                            z.object({
                                type: z.string(),
                                value: z.union([z.string(), z.number(), z.boolean()])
                            })
                        )
                    })
                ).optional()
            })
        }).optional(),
        session: z.object({
            message_id: z.number(),
            session_id: z.string(),
            skill_id: z.string(),
            user: z.object({
                user_id: z.string(),
                access_token: z.string().optional()
            }).optional(),
            application: z.object({
                application_id: z.string()
            }),
            new: z.boolean()
        }),
        state: z.object({
            session: sessionSchema.optional(),
            user: z.record(z.unknown()).optional(),
            application: z.record(z.unknown()).optional()
        }),
        version: z.string().default("1.0")
    });

    
@Injectable()
export class IntentMiddleware implements NestMiddleware {
    private readonly logger = new Logger(IntentMiddleware.name);

    use(req: Request, res: Response, next: NextFunction) {
        try {
            const validatedRequest: AliceRequest<NextHandler> = this.validateRequest(req.body);
            req.url = this.determineRoute(validatedRequest);
            this.logRequest(res);
            next();
        } catch (error) {
            this.handleValidationError(error);
        }
    }

    private validateRequest(body: unknown): AliceRequest<NextHandler> {
        const result = AliceRequestSchema(SessionSchema).safeParse(body);

        if (!result.success) {
            this.logger.error('Validation failed', result.error);
            throw new BadRequestException('Invalid Alice request');
        }

        return result.data;
    }

    private logRequest(res: Response) {
        this.logger.log(`Request: ${res.req.body.request?.original_utterance}`);
    }

    private handleValidationError(error: Error) {
        this.logger.error(`Validation error: ${error.message}`);
        throw error;
    }

    private determineRoute(aliceRequest: AliceRequest<NextHandler>): string {
        const intents = Object.keys(aliceRequest.request?.nlu?.intents || {});
        const command = aliceRequest.request?.command || '';
        const nextHandler = aliceRequest.state.session?.nextHandler || '';

        const matchedIntents = intents.filter(intent => routes.intents.includes(intent));

        if (matchedIntents.length) return `/${matchedIntents.pop()}`;
        if (routes.commands.includes(command)) return `/command${encodeURIComponent(command)}`;
        if (nextHandler) return `/NextHandler${nextHandler}`;
        if(command) return '/unknow';
        return '/';
    }
}

