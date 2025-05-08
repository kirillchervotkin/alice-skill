import e from "express"
import { boolean } from "zod"

/**
 * Интерфейс тела ответа навыка для Яндекс Диалогов
 * @see {@link https://yandex.ru/dev/dialogs/alice/doc/ru/response|Документация}
 */
export interface SkillResponseBody {
    /** Тип ответа (по умолчанию 'text') */
    response_type: string;
    /** Текст ответа, который увидит/услышит пользователь (макс. 1024 символа) */
    text: string;
    /** Флаг завершения сессии */
    end_session: boolean;
    /** Массив кнопок для отображения в интерфейсе */
    buttons?: Button[];
}

/**
 * Интерфейс кнопки для ответа навыка
 * @see {@link https://yandex.ru/dev/dialogs/alice/doc/ru/buttons|Документация}
 */
export interface Button {
    /** Текст на кнопке (макс. 64 символа) */
    title: string;
    /** Флаг скрытия кнопки после нажатия */
    hide: boolean;
}

/**
 * Класс для формирования ответа навыка Яндекс Диалогов
 * @see [Формат ответа](https://yandex.ru/dev/dialogs/alice/doc/ru/response)
 * @see [Хранение состояния](https://yandex.ru/dev/dialogs/alice/doc/ru/session-persistence)
 */
export class SkillResponse {

     /**
     * @param {string} message - Основной текст ответа для пользователя
     * @see [Текст ответа](https://yandex.ru/dev/dialogs/alice/doc/ru/response#response__response-desc)
     * @see [Формат ответа](https://yandex.ru/dev/dialogs/alice/doc/ru/response)
     */
     constructor(message: string) {
        this.response = {
            response_type: 'text',
            text: message,
            end_session: false,
        };
        this.version = "1.0";
    }

    /** 
     * Тело ответа
     * @see [Структура ответа](https://yandex.ru/dev/dialogs/alice/doc/ru/response#response)
     */
    public response: SkillResponseBody;
    
    /** 
     * Версия протокола 
     * @see [Версия протокола](https://yandex.ru/dev/dialogs/alice/doc/ru/response#version)
     */
    public version: string;
    
    /** 
     * Объект для запуска процесса авторизации
     * @see [OAuth-авторизация](https://yandex.ru/dev/dialogs/alice/doc/ru/auth/how-it-works)
     */
    public start_account_linking?: {};
    
    /** 
     * Состояние сессии (сохраняется между запросами)
     * @see [Хранение состояния](https://yandex.ru/dev/dialogs/alice/doc/ru/session-persistence)
     */
    public session_state?: any;

   
}

/**
 * Строитель для создания сложных ответов навыка
 * @see {@link https://yandex.ru/dev/dialogs/alice/doc/ru/session-persistence|Хранение состояния}
 */
export class SkillResponseBuilder {
    private readonly response: SkillResponse;

    /**
     * Конструктор ответа навыка для Яндекс Диалогов
     * @param {string} message - Базовое сообщение для ответа
     * @see [Формат ответа](https://yandex.ru/dev/dialogs/alice/doc/response.html)
     */
    constructor(message: string) {
        this.response = new SkillResponse(message);
    }

    /**
     * Добавить кнопку в конец списка
     * @param {string} title - Текст кнопки (макс. 64 символа)
     * @param {boolean} hide - Скрывать ли кнопку после нажатия
     * @returns {SkillResponseBuilder} this для цепочки вызовов
     * @see [Кнопки в ответе](https://yandex.ru/dev/dialogs/alice/doc/buttons.html)
     */
    public setButton(title: string, hide: boolean): SkillResponseBuilder {
        this.initButtonsIfNeeded();
        this.response.response.buttons!.push({ title, hide });
        return this;
    }

    /**
     * Добавить кнопку в начало списка с проверкой дубликатов
     * @param {string} title - Текст кнопки (макс. 64 символа)
     * @param {boolean} hide - Скрывать ли кнопку после нажатия
     * @returns {SkillResponseBuilder} this для цепочки вызовов
     * @see [Структура кнопок](https://yandex.ru/dev/dialogs/alice/doc/buttons.html)
     */
    public setPrependButton(title: string, hide: boolean): SkillResponseBuilder {
        this.initButtonsIfNeeded();
        this.removeExistingButton(title);
        this.response.response.buttons!.unshift({ title, hide });
        return this;
    }

    /**
     * Добавить массив кнопок
     * @param {Button[]} buttons - Массив объектов кнопок
     * @returns {SkillResponseBuilder} this для цепочки вызовов
     * @see [Работа с кнопками](https://yandex.ru/dev/dialogs/alice/doc/buttons.html)
     */
    public setButtons(buttons: Button[]): SkillResponseBuilder {
        this.initButtonsIfNeeded();
        this.response.response.buttons!.push(...buttons);
        return this;
    }

    /**
     * Завершить текущую сессию (устаревшее)
     * @returns {SkillResponseBuilder} this для цепочки вызовов
     * @see [Завершение сессии](https://yandex.ru/dev/dialogs/alice/doc/session-persistence.html)
     */
    public setEndSesstion(): SkillResponseBuilder {
        return this.setEndSession();
    }

    /**
     * Завершить текущую сессию
     * @returns {SkillResponseBuilder} this для цепочки вызовов
     * @see [Управление сессией](https://yandex.ru/dev/dialogs/alice/doc/session-persistence.html)
     */
    public setEndSession(): SkillResponseBuilder {
        this.response.response.end_session = true;
        return this;
    }

    /**
     * Инициировать процесс авторизации
     * @see [Связка аккаунтов](https://yandex.ru/dev/dialogs/alice/doc/auth.html)
     * @returns {SkillResponseBuilder} this для цепочки вызовов
     */
    public setStartAccountLinking(): SkillResponseBuilder {
        this.response.start_account_linking = {};
        return this;
    }

    /**
     * Сохранить произвольные данные в состоянии сессии
     * @param {any} data - Данные для сохранения (макс. 1 КБ)
     * @returns {SkillResponseBuilder} this для цепочки вызовов
     * @see [Хранение состояния](https://yandex.ru/dev/dialogs/alice/doc/session-persistence.html)
     */
    public setData(data: any): SkillResponseBuilder {
        this.ensureSessionStateExists();
        this.response.session_state!.data = data;
        return this;
    }

    /**
     * Установить следующий обработчик для цепочки диалога
     * @param {string} handlerName - Имя следующего обработчика
     * @returns {SkillResponseBuilder} this для цепочки вызовов
     * @see [Диалоговые состояния](https://yandex.ru/dev/dialogs/alice/doc/session-persistence.html)
     */
    public setNextHandler(handlerName: string): SkillResponseBuilder {
        this.ensureSessionStateExists();
        this.response.session_state!.nextHandler = handlerName;
        return this;
    }

    /**
     * Собрать финальный объект ответа
     * @returns {SkillResponse} Готовый объект ответа
     */
    public build(): SkillResponse {
        return this.response;
    }

    /** Инициализирует массив кнопок при первом вызове */
    private initButtonsIfNeeded(): void {
        if (!this.response.response.buttons) {
            this.response.response.buttons = [];
        }
    }

    /** Удаляет существующую кнопку по заголовку */
    private removeExistingButton(title: string): void {
        const buttons = this.response.response.buttons!;
        const index = buttons.findIndex(b => b.title === title);
        if (index !== -1) {
            buttons.splice(index, 1);
        }
    }

    /** Создает объект состояния сессии при первом вызове */
    private ensureSessionStateExists(): void {
        if (!this.response.session_state) {
            this.response.session_state = {};
        }
    }
}