// src/lib/i18n/index.ts
import { addMessages, init, locale as $locale } from 'svelte-i18n';
import fa from './fa.json';
import en from './en.json';

// زبان‌های راست‌به‌چپ
const RTL_LOCALES = ['fa', 'ar', 'he', 'ur'];

export function initI18n(initial: string = 'fa') {
  // ثبت پیام‌ها
  addMessages('fa', fa);
  addMessages('en', en);

  // نکته: چون می‌خوای فارسی پیش‌فرض باشد، اینجا initial را 'fa' می‌گذاریم
  init({
    fallbackLocale: 'fa',
    initialLocale: initial || 'fa'
  });

  // تنظیم dir در runtime (کلاینت)
  if (typeof document !== 'undefined') {
    const current = initial || 'fa';
    document.documentElement.setAttribute('lang', current);
    document.documentElement.setAttribute('dir', RTL_LOCALES.includes(current) ? 'rtl' : 'ltr');
  }
}

// اگر جایی لازم شد زبان را عوض کنی
export function setLocale(lang: string) {
  $locale.set(lang);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', RTL_LOCALES.includes(lang) ? 'rtl' : 'ltr');
  }
}