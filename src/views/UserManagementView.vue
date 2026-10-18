<script setup lang="ts">
import { ref } from "vue";
import AppNavbar from "../components/AppNavbar.vue";
import { api } from "../lib/api";

type AccountRole = "admin" | "manager" | "cashier";

const USERNAME_PATTERN = "[a-zA-Z0-9._-]+";
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 1024;

const username = ref("");
const displayName = ref("");
const role = ref<AccountRole>("cashier");
const password = ref("");
const confirmPassword = ref("");
const isSaving = ref(false);
const notice = ref<{ ok: boolean; message: string } | null>(null);

async function createAccount(): Promise<void> {
  notice.value = null;
  if (password.value !== confirmPassword.value) {
    notice.value = { ok: false, message: "Passwords do not match." };
    return;
  }

  isSaving.value = true;
  try {
    const createdUsername = username.value.trim();
    await api("/users", {
      method: "POST",
      body: {
        username: createdUsername,
        displayName: displayName.value.trim(),
        role: role.value,
        password: password.value,
      },
    });
    notice.value = { ok: true, message: `Account ${createdUsername} created. They can now sign in.` };
    username.value = "";
    displayName.value = "";
    role.value = "cashier";
    password.value = "";
    confirmPassword.value = "";
  } catch (error) {
    notice.value = { ok: false, message: error instanceof Error ? error.message : "Could not create account." };
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <AppNavbar show-back />
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-blue-700">Admin settings</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900">Create an account</h1>
        <p class="mt-2 text-sm text-slate-600">Only administrators can create accounts. Choose the access level each teammate needs.</p>
      </div>

      <div v-if="notice" role="alert" aria-live="polite" class="mb-5 rounded-2xl border px-4 py-3 text-sm" :class="notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'">
        {{ notice.message }}
      </div>

      <form class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" @submit.prevent="createAccount">
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label for="account-username" class="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
            <input id="account-username" v-model="username" type="text" autocomplete="off" required maxlength="80" :pattern="USERNAME_PATTERN" spellcheck="false" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <p class="mt-1 text-xs text-slate-500">Letters, numbers, periods, underscores, and hyphens.</p>
          </div>
          <div>
            <label for="account-name" class="mb-1.5 block text-sm font-medium text-slate-700">Display name</label>
            <input id="account-name" v-model="displayName" type="text" autocomplete="off" required maxlength="100" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div class="sm:col-span-2">
            <label for="account-role" class="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
            <select id="account-role" v-model="role" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="cashier">Cashier — sales and parked orders</option>
              <option value="manager">Manager — products, taxes, refunds, archives, and analytics</option>
              <option value="admin">Administrator — manager access plus account creation</option>
            </select>
            <p v-if="role === 'admin'" class="mt-1 text-xs text-amber-700">Administrators can create other administrator accounts.</p>
          </div>
          <div>
            <label for="account-password" class="mb-1.5 block text-sm font-medium text-slate-700">Temporary password</label>
            <input id="account-password" v-model="password" type="password" autocomplete="new-password" required :minlength="MIN_PASSWORD_LENGTH" :maxlength="MAX_PASSWORD_LENGTH" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <p class="mt-1 text-xs text-slate-500">At least {{ MIN_PASSWORD_LENGTH }} characters. Share it privately.</p>
          </div>
          <div>
            <label for="account-confirm" class="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</label>
            <input id="account-confirm" v-model="confirmPassword" type="password" autocomplete="new-password" required :minlength="MIN_PASSWORD_LENGTH" :maxlength="MAX_PASSWORD_LENGTH" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        <div class="mt-7 flex justify-end border-t border-slate-100 pt-6">
          <button type="submit" :disabled="isSaving" class="w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {{ isSaving ? "Creating account..." : "Create account" }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>
