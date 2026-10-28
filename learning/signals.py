"""Keep learning data consistent when content or accounts are deleted."""
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone

from content.models import QuizQuestion

from .models import QuizAttempt, SpeakingSubmission


@receiver(post_delete, sender=SpeakingSubmission)
def delete_audio_file(sender, instance, **kwargs):
    """Remove the audio file from disk when a submission (or the student's account) is deleted."""
    if instance.audio:
        instance.audio.delete(save=False)


@receiver(post_delete, sender=QuizQuestion)
def remove_question_from_open_quizzes(sender, instance, **kwargs):
    """Take a deleted question out of quizzes students are still in the middle of, so they
    can carry on. Runs for every way of deleting: the content editor, the admin, the shell."""
    for att in QuizAttempt.objects.filter(finished_at__isnull=True):
        if instance.pk not in att.question_ids:
            continue
        att.question_ids = [i for i in att.question_ids if i != instance.pk]
        if not att.question_ids:
            att.delete()
            continue
        if att.next_question_id() is None:
            att.finished_at = timezone.now()
        att.save(update_fields=["question_ids", "finished_at"])
