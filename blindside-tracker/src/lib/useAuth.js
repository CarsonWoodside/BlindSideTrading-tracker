import { useEffect, useState } from "react";
import { supabase } from './supabaseClient';
import { collectionStore } from './collectionStore';

export function useAuth() {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
            setLoading(false)
        })

        // Listen for sign in / out
        const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession)
        })

        return () => listener.subscription.unsubscribe()
    }, [])

    async function signUp(email, password) {
        setAuthError(null)
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setAuthError(error.message)
        return !error
    }

    async function signIn(email, password) {
        setAuthError(null)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            setAuthError(error.message)
            return false
        }
        if (data.user) {
            await collectionStore.migrateLocalToSupabase(data.user.id)
        }
        return true
    }

    async function signOut() {
        await supabase.auth.signOut()
        setSession(null)
    }

    return {
        user: session?.user ?? null,
        session,
        loading,
        authError,
        signUp,
        signIn,
        signOut,
    }
}