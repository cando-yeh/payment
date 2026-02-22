drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger on_auth_user_updated
after update of email on auth.users
for each row execute function public.sync_profile_email_from_auth_user();
